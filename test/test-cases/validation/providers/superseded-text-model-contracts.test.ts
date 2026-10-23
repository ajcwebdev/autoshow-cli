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
  { service: 'gemini', model: 'gemini-3.1-flash-lite', replacement: { llm: 'gemini-3.8-flash', extract: 'gemini-3.8-flash' }, input: 25, output: 150, cents: 4 }
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
      for (const [flag, successor] of [[service, replacement.llm], [`${service}-ocr`, replacement.extract]] as const) {
        expect(() => buildOptsFromFlags({ [flag]: model })).toThrow(`Use "${successor}" instead`)
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
        expect(registry[category][service]?.models[replacement[category]]).toBeDefined()
        expect(getRetiredModelReplacement(category, service, model)).toBe(replacement[category])
      }
      const all = buildOptsFromFlags({ 'all-llm': true, 'all-ocr': true })
      expect(Reflect.get(all, `${service}Models`)).not.toContain(model)
      expect(Reflect.get(all, `${service}OcrModels`)).not.toContain(model)
      expect(Reflect.get(all, `${service}Models`)).toContain(replacement.llm)
      expect(Reflect.get(all, `${service}OcrModels`)).toContain(replacement.extract)
    }))

    test(`${service}/${model}: direct write and OCR reject before credentials, file reads or network dispatch`, async () => {
      for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY']) delete process.env[key]
      const calls = installMockFetch(() => { throw new Error('Retired identities must never dispatch') })
      await expect(writeRunners[service]('Synthetic prompt.', model)).rejects.toThrow('Unsupported write model')
      await expect(ocrRunners[service](model)).rejects.toThrow(`Use "${replacement.extract}" instead`)
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

  test('historical context bands survive replacement boundaries and removed OpenAI models reject locally', () => {
    const grok = getLlmCost('grok', 'grok-4.5')!
    expect(computeTokenCost(grok, 200000, 1)).toMatchObject({ inputCostPer1MCents: 200, outputCostPer1MCents: 600 })
    expect(computeTokenCost(grok, 200001, 1)).toMatchObject({ inputCostPer1MCents: 400, outputCostPer1MCents: 1200 })
    for (const model of ['gpt-6-astra', 'gpt-5.6-terra']) {
      expect(() => buildOptsFromFlags({ openai: model })).toThrow('Allowed values: gpt-6.1-sol, gpt-6-luna')
      expect(() => buildOptsFromFlags({ 'openai-ocr': model })).toThrow('Allowed values: gpt-6.1-sol, gpt-6-luna')
    }
  })
})
