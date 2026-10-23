import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { getResumeHandler } from '~/cli/commands/setup-and-utilities/resume/resume-registry'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { runTextWrite } from '~/cli/commands/text/write/run-text-write'
import { normalizeResumeSelectorFlagsForTarget } from './provider-selection-contracts/generic-selector-test-adapters'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import type { ResumeTarget, Step3Metadata, WriteRuntimeOptions } from '~/types'

const lifecycle = setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY'], tempPrefix: 'autoshow-p1-routing-' })
const additions = [
  ['openai', 'gpt-6.1-sol'], ['openai', 'gpt-6-luna'],
  ['anthropic', 'claude-opus-5-5'], ['anthropic', 'claude-sonnet-5-5'], ['anthropic', 'claude-haiku-5-5'],
  ['gemini', 'gemini-4-argon'], ['grok', 'grok-4.7']
] as const
const enableCredentials = (): void => {
  for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY']) process.env[key] = 'mock-local'
}
const responseFor = (provider: string, model: string, text: string): Response => Response.json(provider === 'openai'
  ? { status: 'completed', model, output_text: text, usage: { input_tokens: 40, output_tokens: 12 } }
  : provider === 'anthropic'
    ? { model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 40, output_tokens: 12 } }
    : provider === 'gemini'
      ? { modelVersion: model, candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 12 } }
      : { model, choices: [{ finish_reason: 'stop', message: { content: text } }], usage: { prompt_tokens: 40, completion_tokens: 12 } })

describe('P1 text routing, artifact integrity and saved identity', () => {
  for (const [provider, model] of additions) {
    test(`${provider}/${model} recovery adds the exact slot, preserves completed historical output and skips subsequent redispatch`, async () => {
      enableCredentials()
      const calls = installMockFetch(() => responseFor(provider, model, '{"episodeDescription":"A workshop repairs bicycles."}'))
      await lifecycle.withDir(async dir => {
        const source = 'A workshop repairs bicycles for residents.'
        await writeSingleManifestFixture(dir, 'write', {
          title: 'Bicycle workshop',
          source: { kind: 'text-input', inputPath: 'source.txt', slug: 'bicycles', snapshot: { path: 'source.txt', sha256: new Bun.CryptoHasher('sha256').update(source).digest('hex') } },
          step3: { llmService: 'gemini', llmModel: 'gemini-3.8-flash', processingTime: 1, inputTokenCount: 10, outputTokenCount: 2, outputFileName: 'historical.json', outputFormat: 'json', structuredMode: 'native', structuredPresetNames: ['shortSummary'] } satisfies Step3Metadata
        })
        await Bun.write(join(dir, 'source.txt'), source)
        await Bun.write(join(dir, 'prompt.md'), 'Summarize the bicycle workshop.')
        await Bun.write(join(dir, 'historical.json'), '{"episodeDescription":"Completed historical response."}\n')
        const historical = await Bun.file(join(dir, 'historical.json')).text()
        const target: ResumeTarget = { kind: 'write', scope: 'single', dir, manifestPath: join(dir, 'manifest.json') }
        const normalized = normalizeResumeSelectorFlagsForTarget(target, { provider: [`${provider}=${model}`] }, new Set(['provider']))
        const opts = buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags, { flagOccurrences: normalized.flagOccurrences })
        const handler = getResumeHandler('write')!
        await expect(handler.resume(target, opts, normalized.explicitFlags)).resolves.toEqual({ full: 1, incomplete: 0, failed: 0 })
        expect(calls).toHaveLength(1)
        const manifest = await readManifest(dir)
        const raw = manifest?.items[0]?.metadata['step3']
        const entries = (Array.isArray(raw) ? raw : [raw]) as Step3Metadata[]
        const current = entries.find(entry => entry.llmService === provider && entry.llmModel === model)
        expect(current).toMatchObject({ validationFailed: false, inputTokenCount: 40, outputTokenCount: 12 })
        expect(entries.some(entry => entry.llmModel === 'gemini-3.8-flash')).toBe(true)
        expect(await Bun.file(join(dir, current!.outputFileName)).json()).toMatchObject({ episodeDescription: 'A workshop repairs bicycles.' })
        expect(await Bun.file(join(dir, 'historical.json')).text()).toBe(historical)
        await expect(handler.resume(target, opts, normalized.explicitFlags)).resolves.toEqual({ full: 1, incomplete: 0, failed: 0 })
        expect(calls).toHaveLength(1)
      })
    })
  }

  for (const model of ['gpt-6.1-sol', 'gpt-6-luna']) {
    test(`${model} persists deliberately invalid structured output as failed validation evidence`, async () => {
      enableCredentials()
      const invalid = '{"wrongField":"Invalid schema"}'
      const calls = installMockFetch(() => responseFor('openai', model, invalid))
      await lifecycle.withDir(async dir => {
        const input = join(dir, 'source.txt')
        await Bun.write(input, 'A workshop repairs bicycles for residents.')
        const opts = buildOptsFromFlags({ openai: model, prompt: ['shortSummary'] }, {}, new Set(['openai', 'prompt']), { scope: 'write' }) as WriteRuntimeOptions
        const { outputDir } = await runTextWrite(input, dir, opts)
        expect(await Bun.file(join(outputDir, 'text.json')).json()).toMatchObject({ _raw: invalid, _validationError: expect.any(String) })
        const manifest = await readManifest(outputDir)
        expect(manifest?.items[0]?.metadata['step3']).toMatchObject({ llmService: 'openai', llmModel: model, validationFailed: true })
        expect(await Bun.file(join(outputDir, `raw-response-${model}-attempt-1.json`)).json()).toMatchObject({ result: invalid })
        expect(calls).toHaveLength(1)
      })
    })
  }
})
