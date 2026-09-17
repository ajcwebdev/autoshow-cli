import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runDeepinfraOcr } from '~/cli/commands/text/ocr/ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { SUPPORTED_DEEPINFRA_OCR_MODELS, validateDeepinfraOcrModel } from '~/cli/commands/setup-and-utilities/models/ocr-models'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'

const dirs = setupContractSuiteLifecycle({
  envKeys: ['DEEPINFRA_API_KEY'],
  tempPrefix: 'autoshow-deepinfra-ocr-',
  beforeEachExtra: () => { process.env['DEEPINFRA_API_KEY'] = 'synthetic' }
})

// Rates and calibration read from the DeepInfra catalog and a 2026-09-16 single-page
// paid run at 300 DPI; the 25% Qwen promotion is deliberately not priced.
const CATALOG = [
  { model: 'Qwen/Qwen3.8-27B', inputCents: 20, outputCents: 250, promptTokensPerPage: 8320, completionTokensPerPage: 512 },
  { model: 'deepseek-ai/DeepSeek-V4.1-Flash', inputCents: 20, outputCents: 60, promptTokensPerPage: 1088, completionTokensPerPage: 544 }
] as const

const pageFixture = async (dir: string): Promise<{ path: string, metadata: { slug: string, format: 'png', fileSize: number, pageCount: number } }> => {
  const path = join(dir, 'page.png')
  await Bun.write(path, new Uint8Array([1, 2, 3]))
  return { path, metadata: { slug: 'page', format: 'png', fileSize: 3, pageCount: 1 } }
}

describe('DeepInfra vision OCR catalog contracts', () => {
  test('the selector adds the two vision models without moving the pinned bare-provider default', () => {
    expect([...SUPPORTED_DEEPINFRA_OCR_MODELS]).toEqual(['google/gemma-4-31B-it', ...CATALOG.map((entry) => entry.model)])
    for (const { model } of CATALOG) expect(validateDeepinfraOcrModel(model)).toBe(model)
    // The ASR deployments on the same host are not OCR selectors.
    for (const rejected of ['Qwen/Qwen3-ASR-1.7B', 'Qwen/Qwen3.8', 'deepseek-ai/DeepSeek-V4.1']) {
      expect(() => validateDeepinfraOcrModel(rejected)).toThrow('Invalid model')
    }
    expect(resolveCheapestModelForFlag('deepinfra-ocr')).toBe('google/gemma-4-31B-it')
    expect(buildOptsFromFlags({ 'deepinfra-ocr': true }).deepinfraOcrModels).toEqual(['google/gemma-4-31B-it'])
  })

  for (const { model, inputCents, outputCents, promptTokensPerPage, completionTokensPerPage } of CATALOG) {
    test(`${model} stores standard token rates and the calibrated per-page token shape`, () => {
      const entry = requireDefined(getModelRegistry().extract['deepinfra']?.models[model], `DeepInfra OCR ${model}`)
      expect(entry.costPerMInputTokensCents).toBe(inputCents)
      expect(entry.costPerMOutputTokensCents).toBe(outputCents)
      expect(entry.pricingCheckedAt).toBe('2026-09-16')
      expect(entry.estimation).toMatchObject({ costMultiplier: 1, promptTokensPerPage, completionTokensPerPage })
      expect(entry.reasoning).toMatchObject({ support: 'optional', allowDisabled: true, supportedEfforts: ['low', 'medium', 'high'] })
    })

    test(`${model} sends one page image per request and counts usage once`, async () => {
      const calls = installMockFetch(() => jsonResponse({
        choices: [{ finish_reason: 'stop', message: { content: 'Visible page\n\nSecond paragraph', reasoning_content: 'PRIVATE REASONING' } }],
        usage: { prompt_tokens: promptTokensPerPage, completion_tokens: completionTokensPerPage }
      }))
      await dirs.withDir(async (dir) => {
        const { path, metadata } = await pageFixture(dir)
        const result = await runDeepinfraOcr(path, metadata, model, { outputDir: dir, dpi: 300 })
        expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'Visible page\n\nSecond paragraph' }])
        expect(result).toMatchObject({ totalPages: 1, promptTokens: promptTokensPerPage, completionTokens: completionTokensPerPage })
      })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe('https://api.deepinfra.com/v1/openai/chat/completions')
      expect(calls[0]?.bodyJson).toMatchObject({ model, max_tokens: 8192, reasoning_effort: 'none' })
    })

    test(`${model} accepts the declared efforts through dispatch and rejects others locally`, async () => {
      const calls = installMockFetch(() => jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: 'Visible text' } }] }))
      await dirs.withDir(async (dir) => {
        const { path, metadata } = await pageFixture(dir)
        for (const reasoningEffort of ['low', 'medium', 'high'] as const) {
          await runDeepinfraOcr(path, metadata, model, { outputDir: dir, dpi: 300, reasoningEffort })
        }
        for (const reasoningEffort of ['minimal', 'xhigh', 'max'] as const) {
          await expect(runDeepinfraOcr(path, metadata, model, { outputDir: dir, dpi: 300, reasoningEffort })).rejects.toThrow('does not support')
        }
      })
      expect(calls.map((call) => call.bodyJson?.['reasoning_effort'])).toEqual(['low', 'medium', 'high'])
    })

    test(`${model} treats a truncated page as a provider output limit rather than a complete page`, async () => {
      installMockFetch(() => jsonResponse({ choices: [{ finish_reason: 'length', message: { content: 'Incomplete' } }] }))
      await dirs.withDir(async (dir) => {
        const { path, metadata } = await pageFixture(dir)
        await expect(runDeepinfraOcr(path, metadata, model, { outputDir: dir, dpi: 300 })).rejects.toThrow('output token limit')
      })
    })
  }
})
