import { describe, expect, test } from 'bun:test'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  getModelRegistry,
  getRetiredModelReplacement,
  getVideoModelMeta,
  RETIRED_MODEL_REPLACEMENTS
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { getSupportedModelSource } from '~/cli/commands/setup-and-utilities/models/supported-model-sources'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { normalizeExtractGenericSelectorFlags } from '~/cli/flags/service-selector-normalization/extract-selectors'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS,
  WRITE_OCR_PROVIDER_TARGETS,
  WRITE_STT_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import type { ModelCategory } from '~/types'
import { flagOccurrencesFromValues } from '../../../test-utils/flag-occurrences'
import { withTempDir } from '../../../test-utils/temp-dirs'

const retiredMiniMaxModels = [
  'MiniMax-Hailuo-2.3', 'MiniMax-Hailuo-2.3-Fast', 'T2V-01', 'T2V-01-Director',
  'I2V-01', 'I2V-01-Director', 'I2V-01-live', 'S2V-01'
] as const

const providerTargets: Record<ModelCategory, Readonly<Record<string, string>>> = {
  stt: WRITE_STT_PROVIDER_TARGETS, extract: WRITE_OCR_PROVIDER_TARGETS, llm: WRITE_LLM_PROVIDER_TARGETS,
  tts: STANDALONE_TTS_PROVIDER_TARGETS, image: STANDALONE_IMAGE_PROVIDER_TARGETS,
  music: STANDALONE_MUSIC_PROVIDER_TARGETS, video: STANDALONE_VIDEO_PROVIDER_TARGETS
}

describe('retired model successor contracts', () => {
  test('every advertised successor belongs to an active workflow/host and passes public selector normalization', () => {
    const registry = getModelRegistry()
    let checked = 0
    for (const category of Object.keys(RETIRED_MODEL_REPLACEMENTS) as ModelCategory[]) {
      for (const [retiredKey, replacement] of Object.entries(RETIRED_MODEL_REPLACEMENTS[category])) {
        const originalService = retiredKey.slice(0, retiredKey.indexOf(':'))
        // The executing catalog is the oracle; the replacement table does not define active hosts.
        const activeHosts = Object.entries(registry[category])
          .filter(([, service]) => service.models[replacement] !== undefined)
          .map(([service]) => service)
        const label = `${category}/${retiredKey} -> ${replacement}`
        expect(activeHosts.length, label).toBeGreaterThan(0)
        // Same-host successors retain their host; cross-host hints must resolve unambiguously.
        if (!activeHosts.includes(originalService)) expect(activeHosts, label).toHaveLength(1)
        const service = activeHosts.includes(originalService) ? originalService : activeHosts[0]!
        expect(getSupportedModelSource(category, service)?.models, label).toContain(replacement)
        const targets = providerTargets[category]
        // STT's gemini-stt registry identity is exposed as --provider gemini, not gemini-stt.
        const publicEntry = Object.entries(targets).find(([provider, flag]) => provider === service || flag === service)
        expect(publicEntry, label).toBeDefined()
        const [provider, flag] = publicEntry!
        const selector = category === 'llm' ? 'llm' : 'provider'
        const flags = { [selector]: [`${provider}=${replacement}`] }
        const explicit = new Set([selector]), occurrences = flagOccurrencesFromValues(flags, explicit)
        const normalized = category === 'stt' || category === 'extract'
          ? normalizeExtractGenericSelectorFlags(flags, explicit, occurrences,
            { media: category === 'stt', document: category === 'extract', article: false })
          : normalizeGenericProviderSelectorFlags(flags, explicit, occurrences, selector, targets)
        expect(normalized.flagOccurrences.some(occurrence => occurrence.name === flag && occurrence.value === replacement), label).toBe(true)
        expect(() => buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags,
          { flagOccurrences: normalized.flagOccurrences }), label).not.toThrow()
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  test('the eight MiniMax video identities retain historical rates without advertising an unavailable successor', () => {
    const registry = getModelRegistry().video
    for (const model of retiredMiniMaxModels) {
      expect(registry['minimax']?.models[model], model).toBeUndefined()
      expect(getRetiredModelReplacement('video', 'minimax', model), model).toBeUndefined()
      const expected = model === 'MiniMax-Hailuo-2.3'
        ? { blockSizeSec: 6, blockCost720pCents: 28, blockCost1080pCents: 49 }
        : model === 'MiniMax-Hailuo-2.3-Fast'
          ? { fixedCostByResolutionDurationCents: { '720p': { '6': 19, '10': 32 }, '1080p': { '6': 33 } } }
          : { blockSizeSec: 6, blockCost720pCents: 19 }
      expect(getVideoModelMeta('minimax', model), model).toEqual(expected)
    }
  })

  test('all eight retired MiniMax selectors fail actual CLI price validation before fetch or output creation', async () => {
    await withTempDir('autoshow-retired-successors-', async root => {
      const preload = join(root, 'deny-fetch.ts'), config = join(root, 'config.json')
      await writeFile(config, '{}\n')
      await writeFile(preload, [
        'import { writeFileSync } from "node:fs"',
        'let calls = 0',
        'globalThis.fetch = Object.assign(() => { calls++; throw new Error("Unexpected provider dispatch") }, { preconnect() {} })',
        'process.once("exit", () => writeFileSync(process.env.AUTOSHOW_SUCCESSOR_FETCH_AUDIT!, JSON.stringify({ calls })))'
      ].join('\n') + '\n')
      for (const [index, model] of retiredMiniMaxModels.entries()) {
        const audit = join(root, `fetch-${index}.json`), output = join(root, `output-${index}`)
        const result = Bun.spawnSync([process.execPath, '--no-env-file', '--preload', preload,
          'src/cli/create-cli.ts', 'video', 'A simple static scene', '--provider', `minimax=${model}`,
          '--config-path', config, '--output-dir', output, '--price', '--json'], {
          env: { PATH: process.env['PATH'] ?? '', NO_COLOR: '1', AUTOSHOW_SUCCESSOR_FETCH_AUDIT: audit },
          stdout: 'pipe', stderr: 'pipe'
        })
        const stdout = new TextDecoder().decode(result.stdout)
        const record = JSON.parse(stdout.trim()) as { type: string, exitCode: number, error: { kind: string, message: string } }
        expect(result.exitCode, model).toBe(2)
        expect(record, model).toMatchObject({ type: 'result', exitCode: 2, error: { kind: 'usage' } })
        expect(record.error.message, model).toBe(`Model "${model}" is retired for --provider minimax=<model>. Choose an active video provider and model explicitly. AutoShow will not silently substitute a different model identity.`)
        expect(record.error.message, model).not.toContain('MiniMax-H3')
        expect(JSON.parse(await readFile(audit, 'utf8')), model).toEqual({ calls: 0 })
        expect(await stat(output).catch(() => null), model).toBeNull()
      }
    })
  }, 15000)
})
