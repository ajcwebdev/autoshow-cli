import { resolveActualExtractCostEntry, resolveEstimatedExtractCostEntry } from '~/cli/commands/pricing-orchestration/provider-family-resolvers'
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { runDeepinfraOcr } from '~/cli/commands/text/ocr/ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { validateDeepinfraOcrModel } from '~/cli/commands/setup-and-utilities/models/ocr-models'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: ['DEEPINFRA_API_KEY'], tempPrefix: 'autoshow-priority-ocr-', beforeEachExtra: () => { process.env['DEEPINFRA_API_KEY'] = 'synthetic' } })
const model = 'google/gemma-4-31B-it'
test('Gemma OCR serializes a single page, excludes reasoning text, and counts usage once', async () => {
  expect(validateDeepinfraOcrModel(model)).toBe(model)
  expect(getModelRegistry().extract['deepinfra']?.models[model]).toBeDefined()
  const calls = installMockFetch(() => jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: 'Visible page\n\nSecond paragraph', reasoning_content: 'PRIVATE REASONING' } }], usage: { prompt_tokens: 120, completion_tokens: 30 } }))
  await dirs.withDir(async dir => {
    const path = join(dir, 'page.png'); await Bun.write(path, new Uint8Array([1, 2, 3]))
    const result = await runDeepinfraOcr(path, { slug: 'page', format: 'png', fileSize: 3, pageCount: 1 }, model, { outputDir: dir, dpi: 144 })
    expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'Visible page\n\nSecond paragraph' }])
    expect(result).toMatchObject({ totalPages: 1, promptTokens: 120, completionTokens: 30 })
  })
  expect(calls).toHaveLength(1)
  expect(calls[0]?.url).toBe('https://api.deepinfra.com/v1/openai/chat/completions')
  expect(calls[0]?.bodyJson).toMatchObject({ model, max_tokens: 8192, reasoning_effort: 'none' })
})

// Native controls: https://docs.deepinfra.com/chat/reasoning
test('Gemma OCR dispatches default, low, and reset reasoning and rejects unsupported effort locally', async () => {
  const calls = installMockFetch(() => jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: 'Visible text' } }] }))
  await dirs.withDir(async dir => {
    const path = join(dir, 'page.png')
    await Bun.write(path, new Uint8Array([1]))
    const metadata = { slug: 'page', format: 'png' as const, fileSize: 1, pageCount: 1 }
    for (const reasoningEffort of [undefined, 'low', 'default'] as const) await runDeepinfraOcr(path, metadata, model, { outputDir: dir, dpi: 144, reasoningEffort })
    await expect(runDeepinfraOcr(path, metadata, model, { outputDir: dir, dpi: 144, reasoningEffort: 'max' })).rejects.toThrow()
  })
  expect(calls).toHaveLength(3)
  expect(calls.map(call => call.bodyJson?.['reasoning_effort'])).toEqual(['none', 'low', 'none'])
})

test('Gemma OCR HTTP success with truncated text is rejected as a provider limit', async () => {
  const calls = installMockFetch(() => jsonResponse({ choices: [{ finish_reason: 'length', message: { content: 'Incomplete' } }] }))
  await dirs.withDir(async dir => {
    const path = join(dir, 'page.png'); await Bun.write(path, new Uint8Array([1]))
    await expect(runDeepinfraOcr(path, { slug: 'page', format: 'png', fileSize: 1, pageCount: 1 }, model, { outputDir: dir, dpi: 144 })).rejects.toMatchObject({ category: 'provider_limit', rawResponse: 'Incomplete' })
  })
  expect(calls).toHaveLength(1)
})

test('Gemma OCR uses identical rates for observed preflight and actual usage', () => {
  const expected = (120 * 13 + 30 * 38) / 1_000_000
  const estimate = resolveEstimatedExtractCostEntry({ provider: 'deepinfra', model, pageCount: 1, promptTokens: 120, completionTokens: 30, estimateType: 'exact' }, { applyCostMultipliers: false })
  const actual = resolveActualExtractCostEntry({ extractionMethod: 'deepinfra-ocr', ocrService: 'deepinfra', ocrModel: model, totalPages: 1, ocrPages: 1, textPages: 0, processingTime: 1, dpi: 144, languages: 'eng', tokenEstimate: 0, promptTokens: 120, completionTokens: 30 }, 'deepinfra', model)
  expect(estimate.cost).toBeCloseTo(expected, 10)
  expect(actual?.cost).toBeCloseTo(expected, 10)
})
