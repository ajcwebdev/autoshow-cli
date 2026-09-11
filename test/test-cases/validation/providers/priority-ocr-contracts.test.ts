import { resolveActualExtractCostEntry, resolveEstimatedExtractCostEntry } from '~/cli/commands/pricing-orchestration/provider-family-resolvers'
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { runGlmOcr } from '~/cli/commands/text/ocr/ocr-services/glm-ocr/run-glm-ocr'
import { runDeepinfraOcr } from '~/cli/commands/text/ocr/ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { validateGlmOcrModel, validateDeepinfraOcrModel } from '~/cli/commands/setup-and-utilities/models/ocr-models'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: ['GLM_API_KEY', 'DEEPINFRA_API_KEY'], tempPrefix: 'autoshow-priority-ocr-', beforeEachExtra: () => { process.env['GLM_API_KEY'] = 'synthetic'; process.env['DEEPINFRA_API_KEY'] = 'synthetic' } })
const models = ['glm-5.3-flash', 'google/gemma-4-31B-it', 'google/gemma-4-26B-A4B-it'] as const
for (const model of models) test(`${model} serializes a single page, excludes reasoning text, and counts usage once`, async () => {
  const service = model === 'glm-5.3-flash' ? 'glm' : 'deepinfra'
  expect(service === 'glm' ? validateGlmOcrModel(model) : validateDeepinfraOcrModel(model)).toBe(model)
  expect(getModelRegistry().extract[service]?.models[model]).toBeDefined()
  const calls = installMockFetch(() => jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: 'Visible page\n\nSecond paragraph', reasoning_content: 'PRIVATE REASONING' } }], usage: { prompt_tokens: 120, completion_tokens: 30 } }))
  await dirs.withDir(async dir => {
    const path = join(dir, 'page.png'); await Bun.write(path, new Uint8Array([1, 2, 3]))
    const metadata = { slug: 'page', format: 'png' as const, fileSize: 3, pageCount: 1 }
    const result = service === 'glm' ? await runGlmOcr(path, metadata, model) : await runDeepinfraOcr(path, metadata, model, { outputDir: dir, dpi: 144 })
    expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'Visible page\n\nSecond paragraph' }])
    expect(result).toMatchObject({ totalPages: 1, promptTokens: 120, completionTokens: 30 })
  })
  expect(calls).toHaveLength(1)
  expect(calls[0]?.url).toContain('/chat/completions')
  expect(calls[0]?.bodyJson).toMatchObject({ model, max_tokens: service === 'glm' ? 32768 : 8192, ...(service === 'glm' ? { thinking: { type: 'enabled' } } : { reasoning_effort: 'none' }) })
})

test('mandatory GLM reasoning and unsupported images fail without a provider submission', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected network') })
  expect(() => resolveReasoningPolicy({ step: 'extract', service: 'glm', model: 'glm-5.3-flash', requestedReasoningEffort: 'disabled' })).toThrow()
  await dirs.withDir(async dir => {
    const path = join(dir, 'page.pdf'); await Bun.write(path, new Uint8Array([1]))
    await expect(runGlmOcr(path, { slug: 'page', format: 'pdf', fileSize: 1, pageCount: 1 }, 'glm-5.3-flash')).rejects.toThrow()
  })
  expect(calls).toHaveLength(0)
})

test('truncated OCR is rejected rather than published as a completed page', async () => {
  installMockFetch(() => jsonResponse({ choices: [{ finish_reason: 'length', message: { content: 'Incomplete' } }] }))
  await dirs.withDir(async dir => {
    const path = join(dir, 'page.png'); await Bun.write(path, new Uint8Array([1]))
    await expect(runGlmOcr(path, { slug: 'page', format: 'png', fileSize: 1, pageCount: 1 }, models[0])).rejects.toThrow('token limit')
  })
})

test('all three OCR targets use identical rates for observed preflight and actual usage', () => {
  for (const [provider, model, inputRate, outputRate] of [
    ['glm', 'glm-5.3-flash', 15, 50],
    ['deepinfra', 'google/gemma-4-31B-it', 13, 38],
    ['deepinfra', 'google/gemma-4-26B-A4B-it', 7, 34],
  ] as const) {
    const expected = (120 * inputRate + 30 * outputRate) / 1_000_000
    const estimate = resolveEstimatedExtractCostEntry({ provider, model, pageCount: 1, promptTokens: 120, completionTokens: 30, estimateType: 'exact' }, { applyCostMultipliers: false })
    const actual = resolveActualExtractCostEntry({ extractionMethod: provider === 'glm' ? 'glm-ocr' : 'deepinfra-ocr', ocrService: provider, ocrModel: model, totalPages: 1, ocrPages: 1, textPages: 0, processingTime: 1, dpi: 144, languages: 'eng', tokenEstimate: 0, promptTokens: 120, completionTokens: 30 }, provider, model)
    expect(estimate.cost).toBeCloseTo(expected, 10)
    expect(actual?.cost).toBeCloseTo(expected, 10)
  }
})
