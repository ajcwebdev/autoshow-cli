import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { buildConfigPatchFromFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { getExtractPricing, getLlmCost, getModelRegistry, getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { computeOcrTokenCost } from '~/utils/pricing/ocr-token-pricing'
import { runOpenAIModel } from '~/cli/commands/text/write/write-services/write-openai/run-openai'
import { runAnthropicModel } from '~/cli/commands/text/write/write-services/write-anthropic/run-anthropic'
import { runGeminiModel } from '~/cli/commands/text/write/write-services/write-gemini/run-gemini'
import { runGrokModel } from '~/cli/commands/text/write/write-services/write-grok/run-grok'
import { runOpenAIOcr } from '~/cli/commands/text/ocr/ocr-services/openai-ocr/run-openai-ocr'
import { runAnthropicOcr } from '~/cli/commands/text/ocr/ocr-services/anthropic-ocr/run-anthropic-ocr'
import { runGeminiOcr } from '~/cli/commands/text/ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { runGrokOcr } from '~/cli/commands/text/ocr/ocr-services/grok-ocr/run-grok-ocr'
import { prepareGenerationResume } from '~/cli/commands/setup-and-utilities/resume/generation-resume-preparation'
import { writeResumeConfig } from '~/cli/commands/setup-and-utilities/resume/resume-write/write-resume'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import type { PipelineManifest, ResumeTarget } from '~/types'

const lifecycle = setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY'], tempPrefix: 'autoshow-superseded-models-' })
// Historical uncached tariffs in USD cents per million tokens, pinned by the finished runs.
// These are deliberately independent of the active catalog and replacement prices.
const retired = [
  { service: 'openai', model: 'gpt-5.6-sol', replacement: 'gpt-6.1-sol', input: 400, output: 2000, cents: 60 },
  { service: 'openai', model: 'gpt-5.6-luna', replacement: 'gpt-6-luna', input: 20, output: 120, cents: 3.2 },
  { service: 'gemini', model: 'gemini-3.7-flash', replacement: 'gemini-3.8-flash', input: 150, output: 750, cents: 22.5 },
  { service: 'anthropic', model: 'claude-sonnet-5', replacement: 'claude-sonnet-5-5', input: 200, output: 1000, cents: 30 },
  { service: 'anthropic', model: 'claude-opus-5', replacement: 'claude-opus-5-5', input: 500, output: 2500, cents: 75 },
  { service: 'grok', model: 'grok-4.6', replacement: 'grok-4.7', input: 200, output: 600, cents: 26 }
] as const
const writeRunners = { openai: runOpenAIModel, anthropic: runAnthropicModel, gemini: runGeminiModel, grok: runGrokModel }
const metadata = { slug: 'missing', format: 'png' as const, pageCount: 1, fileSize: 1 }
const ocrRunners = {
  openai: (model: string) => runOpenAIOcr('/missing', metadata, model),
  anthropic: (model: string) => runAnthropicOcr('/missing', metadata, model),
  gemini: (model: string) => runGeminiOcr('/missing', metadata, model, {}),
  grok: (model: string) => runGrokOcr('/missing', metadata, model, { dpi: 150, outputDir: '.' })
}

describe('superseded write and OCR identities are retired without rewriting history', () => {
  for (const { service, model, replacement, input, output, cents } of retired) {
    test(`${service}/${model}: selectors, setup, saved config and resume reject with an active replacement`, async () => lifecycle.withDir(async dir => {
      for (const flag of [service, `${service}-ocr`]) {
        expect(() => buildOptsFromFlags({ [flag]: model })).toThrow(`Use "${replacement}" instead`)
        expect(() => buildConfigPatchFromFlags({ [flag]: model }, new Set([flag]))).toThrow('Unsupported configured')
      }
      const path = join(dir, 'config.json')
      for (const defaults of [{ llm: { [service]: [model] } }, { extract: { ocr: { [`${service}Ocr`]: [model] } } }]) {
        await Bun.write(path, JSON.stringify({ defaults }))
        await expect(loadConfig(path)).rejects.toThrow('Unsupported configured')
      }
      const target: ResumeTarget = { kind: 'write', scope: 'single', dir, manifestPath: join(dir, 'manifest.json') }
      const manifest = { command: 'write', scope: 'single', items: [{ metadata: {}, providers: [{ service, model, status: 'failed' }] }] } as unknown as PipelineManifest
      await expect(prepareGenerationResume(target, writeResumeConfig, buildOptsFromFlags({}), new Set(), true, 0, manifest)).rejects.toThrow('Unsupported saved write model')
      const registry = getModelRegistry()
      for (const category of ['llm', 'extract'] as const) {
        expect(registry[category][service]?.models[model]).toBeUndefined()
        expect(registry[category][service]?.models[replacement]).toBeDefined()
        expect(getRetiredModelReplacement(category, service, model)).toBe(replacement)
      }
      const all = buildOptsFromFlags({ 'all-llm': true, 'all-ocr': true })
      expect(Reflect.get(all, `${service}Models`)).not.toContain(model)
      expect(Reflect.get(all, `${service}OcrModels`)).not.toContain(model)
      expect(Reflect.get(all, `${service}Models`)).toContain(replacement)
      expect(Reflect.get(all, `${service}OcrModels`)).toContain(replacement)
    }))

    test(`${service}/${model}: direct write and OCR reject before credentials, file reads or network dispatch`, async () => {
      for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY']) delete process.env[key]
      const calls = installMockFetch(() => { throw new Error('Retired identities must never dispatch') })
      await expect(writeRunners[service]('Synthetic prompt.', model)).rejects.toThrow('Unsupported write model')
      await expect(ocrRunners[service](model)).rejects.toThrow(`Use "${replacement}" instead`)
      expect(calls).toHaveLength(0)
    })

    test(`${service}/${model}: completed write and OCR usage retain their original tariffs`, () => {
      const write = getLlmCost(service, model)
      expect(write).toMatchObject({ inputCostPer1MCents: input, outputCostPer1MCents: output })
      const ocr = getExtractPricing(service, model)
      expect(ocr).toMatchObject({ inputCostPer1MCents: input, outputCostPer1MCents: output })
      expect(computeTokenCost(write!, 100_000, 10_000).totalCost).toBeCloseTo(cents, 10)
      expect(computeOcrTokenCost(ocr, 0, 0, 100_000, 10_000).totalCost).toBeCloseTo(cents, 10)
    })
  }

  test('historical context bands survive replacement boundaries and GPT-5.6 Terra remains active', () => {
    const sol = getLlmCost('openai', 'gpt-5.6-sol')!
    expect(computeTokenCost(sol, 272000, 1)).toMatchObject({ inputCostPer1MCents: 400, outputCostPer1MCents: 2000 })
    expect(computeTokenCost(sol, 272001, 1)).toMatchObject({ inputCostPer1MCents: 800, outputCostPer1MCents: 3000 })
    const grok = getLlmCost('grok', 'grok-4.6')!
    expect(computeTokenCost(grok, 200000, 1)).toMatchObject({ inputCostPer1MCents: 200, outputCostPer1MCents: 600 })
    expect(computeTokenCost(grok, 200001, 1)).toMatchObject({ inputCostPer1MCents: 400, outputCostPer1MCents: 1200 })
    expect(buildOptsFromFlags({ openai: 'gpt-5.6-terra', 'openai-ocr': 'gpt-5.6-terra' })).toMatchObject({ openaiModels: ['gpt-5.6-terra'], openaiOcrModels: ['gpt-5.6-terra'] })
  })
})
