import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { buildConfigPatchFromFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { resolveCheapestModelForFlag, selectCheapestDefaultLlmSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { collectLlmTargets } from '~/cli/commands/text/write/run-llm'
import { getResumeHandler } from '~/cli/commands/setup-and-utilities/resume/resume-registry'
import { normalizeResumeSelectorFlagsForTarget } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { sha256Bytes } from '~/utils/value-helpers'
import { normalizeGenericProviderSelectorFlags } from '../providers/provider-selection-contracts/generic-selector-test-adapters'
import { flagOccurrencesFromValues } from '../../../test-utils/flag-occurrences'
import type { ResumeTarget, Step3Metadata } from '~/types'

const frontier = [
  ['openai', 'gpt-6-astra', 'gpt-6-luna'],
  ['openai', 'gpt-6.1-terra', 'gpt-6-luna'],
  ['anthropic', 'claude-fable-5-2', 'claude-haiku-5-5'],
  ['gemini', 'gemini-4-carbon', 'gemini-3.8-flash']
] as const
const lifecycle = setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'], tempPrefix: 'frontier-write-selection-' })

describe('frontier write selection, configuration and recovery', () => {
  test('the complete 12-model expansion preserves cheapest provider and omitted-provider defaults', () => {
    const targets = collectLlmTargets({ ...buildOptsFromFlags({ 'all-llm': true }), outputDir: '.' })
    expect(targets).toHaveLength(12)
    expect(new Set(targets.map(target => `${target.service}:${target.model}`)).size).toBe(12)
    for (const [service, model] of frontier) expect(targets.map(target => `${target.service}:${target.model}`)).toContain(`${service}:${model}`)
    for (const [service, model] of [
      ['openai', 'gpt-6-luna'], ['anthropic', 'claude-haiku-5-5'], ['gemini', 'gemini-3.8-flash'], ['grok', 'grok-4.7']
    ]) expect(resolveCheapestModelForFlag(service!)).toBe(model)
    expect(selectCheapestDefaultLlmSelection()).toMatchObject({ provider: 'anthropic', model: 'claude-haiku-5-5' })
  })

  for (const [service, model, cheapest] of frontier) {
    test(`${model}: explicit selection, saved configuration, override and reset retain the requested identity`, async () => lifecycle.withDir(async root => {
      const normalized = normalizeGenericProviderSelectorFlags({ provider: [`${service}=${model}`], 'reasoning-effort': 'high' }, new Set(['provider', 'reasoning-effort']), 'provider', WRITE_LLM_PROVIDER_TARGETS)
      const selected = buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags)
      expect(collectLlmTargets({ ...selected, outputDir: root }).map(target => `${target.service}:${target.model}`)).toEqual([`${service}:${model}`])
      expect(selected.reasoningEffort).toBe('high')
      const path = join(root, 'config.json')
      const patch = buildConfigPatchFromFlags({ [service]: model }, new Set([service]))
      await Bun.write(path, JSON.stringify(patch))
      const saved = await loadConfig(path)
      const fromSaved = buildOptsFromFlags(mergeConfigIntoRawFlags({}, saved, new Set()))
      expect(collectLlmTargets({ ...fromSaved, outputDir: root }).map(target => target.model)).toEqual([model])
      const overridden = buildOptsFromFlags(mergeConfigIntoRawFlags({ [service]: cheapest }, saved, new Set([service])))
      expect(collectLlmTargets({ ...overridden, outputDir: root }).map(target => target.model)).toEqual([cheapest])
      await Bun.write(path, '{}')
      const reset = await loadConfig(path)
      expect(reset).toEqual({})
      expect(Reflect.get(buildOptsFromFlags(mergeConfigIntoRawFlags({ [service]: true }, reset, new Set([service]))), `${service}Models`)).toEqual([cheapest])
    }))

    test(`${model}: remains write-only across OCR and STT registry, selectors and saved OCR configuration`, async () => lifecycle.withDir(async root => {
      const registry = getModelRegistry()
      expect(registry.extract[service]?.models[model]).toBeUndefined()
      for (const provider of Object.values(registry.stt)) expect(provider.models[model]).toBeUndefined()
      expect(() => buildOptsFromFlags({ [`${service}-ocr`]: model })).toThrow()
      expect(() => buildConfigPatchFromFlags({ [`${service}-ocr`]: model }, new Set([`${service}-ocr`]))).toThrow(`Unsupported configured model ${service}/${model}`)
      const path = join(root, 'ocr-config.json')
      await Bun.write(path, JSON.stringify({ defaults: { extract: { ocr: { [`${service}Ocr`]: [model] } } } }))
      await expect(loadConfig(path)).rejects.toThrow('Unsupported configured ocr model')
      const expanded = buildOptsFromFlags({ 'all-ocr': true, 'all-stt': true })
      expect(Reflect.get(expanded, `${service}OcrModels`)).not.toContain(model)
      for (const value of Object.values(expanded)) if (Array.isArray(value)) expect(value).not.toContain(model)
    }))

    test(`${model}: write resume dispatches its selected model and preserves usage, reasoning and schema evidence`, async () => lifecycle.withDir(async root => {
      process.env['OPENAI_API_KEY'] = 'fixture-openai'
      process.env['ANTHROPIC_API_KEY'] = 'fixture-anthropic'
      process.env['GEMINI_API_KEY'] = 'fixture-gemini'
      const source = 'Synthetic source material for a concise summary.'
      await writeSingleManifestFixture(root, 'write', {
        title: 'Synthetic recovery fixture',
        source: { kind: 'text-input', inputPath: 'source.txt', slug: 'frontier-resume', snapshot: { path: 'source.txt', sha256: sha256Bytes(source) } },
        step3: []
      })
      await Bun.write(join(root, 'source.txt'), source)
      await Bun.write(join(root, 'prompt.md'), 'Return a short synthetic episode description.')
      const responseText = JSON.stringify({ episodeDescription: 'A concise synthetic summary.' })
      const returnedModel = `${model}-provider-snapshot`
      const calls = installMockFetch(() => {
        if (service === 'openai') return jsonResponse({ model: returnedModel, status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: responseText }] }], usage: { input_tokens: 23, output_tokens: 11, total_tokens: 34 } })
        if (service === 'anthropic') return jsonResponse({ model: returnedModel, stop_reason: 'end_turn', content: [{ type: 'text', text: responseText }], usage: { input_tokens: 23, output_tokens: 11 } })
        return jsonResponse({ modelVersion: returnedModel, candidates: [{ finishReason: 'STOP', content: { parts: [{ text: responseText }] } }], usageMetadata: { promptTokenCount: 23, candidatesTokenCount: 7, thoughtsTokenCount: 4, totalTokenCount: 34 } })
      })
      const target: ResumeTarget = { kind: 'write', scope: 'single', dir: root, manifestPath: join(root, 'manifest.json') }
      const raw = { provider: [`${service}=${model}`], prompt: ['shortSummary'], 'reasoning-effort': 'high' }
      const normalized = normalizeResumeSelectorFlagsForTarget(target, raw, new Set(Object.keys(raw)), flagOccurrencesFromValues(raw, new Set(Object.keys(raw))))
      const opts = buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags, { flagOccurrences: normalized.flagOccurrences })
      const explicit = normalized.explicitFlags
      const handler = getResumeHandler('write')!
      await expect(handler.resume(target, opts, explicit)).resolves.toEqual({ full: 1, incomplete: 0, failed: 0 })
      expect(calls).toHaveLength(1)
      const manifest = await readManifest(root)
      const stored = manifest?.items[0]?.metadata['step3'] as Step3Metadata
      expect(stored).toMatchObject({ llmService: service, llmModel: model, providerReturnedModel: returnedModel, inputTokenCount: 23, outputTokenCount: 11, tokenCountSource: 'provider_usage', requestedReasoningEffort: 'high', effectiveReasoningEffort: 'high', structuredMode: 'native', structuredPresetNames: ['shortSummary'], validationFailed: false })
      expect(stored.rawProviderUsage).toBeDefined()
      expect(stored.requestSettings).toBeDefined()
      expect(JSON.stringify(stored.requestSettings)).toMatch(/(?:schema|responseJsonSchema)Sha256":"[a-f0-9]{64}"/)
      expect(await Bun.file(join(root, stored.outputFileName)).json()).toEqual(JSON.parse(responseText))
      const recorded = JSON.stringify(stored)
      await expect(handler.resume(target, opts, explicit)).resolves.toEqual({ full: 1, incomplete: 0, failed: 0 })
      expect(calls).toHaveLength(1)
      expect(JSON.stringify((await readManifest(root))?.items[0]?.metadata['step3'])).toBe(recorded)
    }))
  }
})
