import { describe, expect, test } from 'bun:test'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { requireDefined } from '../../../test-utils/value-assertions'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { validateGeminiModel } from '~/cli/commands/setup-and-utilities/models/llm-models'
import { validateGeminiOcrModel } from '~/cli/commands/setup-and-utilities/models/ocr-models'
import { validateGeminiSttModel } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { getLlmCost, getExtractPricing, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeGeminiSttBillingFromUsage } from '~/cli/commands/stt/diarization-off-by-default/gemini-stt/run-gemini-stt'
import { installMockFetch, jsonResponse } from '../../../test-utils/rest-contract-helpers'
import { setupGeminiRestContractFixture } from './gemini-rest-contract-fixture'

setupGeminiRestContractFixture()
const model = 'gemini-3.8-flash'

describe('Gemini 3.8 Flash contracts', () => {
  test('all workflow validators accept the addition and preserve defaults', () => {
    for (const validate of [validateGeminiModel, validateGeminiOcrModel, validateGeminiSttModel]) {
      expect(() => validate(model)).not.toThrow()
      expect(() => validate('gemini-3.6-flash')).not.toThrow()
    }
    expect(resolveCheapestModelForFlag('gemini-stt')).toBe('gemini-3.6-flash')
    expect(resolveCheapestModelForFlag('gemini')).toBe('gemini-3.5-flash-lite')
  })

  for (const step of ['llm', 'extract'] as const) {
    test(`${step} validates thinking efforts`, () => {
      for (const requestedReasoningEffort of ['low', 'medium', 'high', 'default'] as const) {
        expect(resolveReasoningPolicy({ step, service: 'gemini', model, requestedReasoningEffort }).effective).toBe(requestedReasoningEffort)
      }
      for (const requestedReasoningEffort of ['minimal', 'disabled', 'xhigh', 'max'] as const) {
        expect(() => resolveReasoningPolicy({ step, service: 'gemini', model, requestedReasoningEffort })).toThrow()
      }
      expect(resolveReasoningPolicy({ step, service: 'gemini', model, requestedReasoningEffort: undefined }).effective).toBe(step === 'extract' ? 'low' : 'default')
    })
  }

  test('transport rejects incompatible options before any network call', async () => {
    const calls = installMockFetch(() => jsonResponse({}))
    for (const generationConfig of [
      ...['temperature', 'topP', 'topK', 'top_p', 'top_k', 'candidateCount', 'candidate_count'].map(key => ({ [key]: 1 })),
      { thinkingConfig: { thinkingLevel: 'MINIMAL' } },
      { thinkingConfig: { thinkingBudget: 0 } }
    ]) {
      await expect(geminiGenerateContent('fake', { model, contents: 'synthetic prompt', generationConfig })).rejects.toThrow('gemini-3.8-flash')
    }
    expect(calls).toHaveLength(0)
  })

  test('all price paths use documented conservative standard rates with no context tier', () => {
    const ocr = requireDefined(getExtractPricing('gemini', model), 'OCR rates')
    const ocrRates = { ...ocr, inputCostPer1MCents: requireDefined(ocr.inputCostPer1MCents, 'OCR input rate'), outputCostPer1MCents: requireDefined(ocr.outputCostPer1MCents, 'OCR output rate') }
    for (const inputTokens of [0, 200_000, 200_001, 1_000_000]) {
      expect(computeTokenCost(requireDefined(getLlmCost('gemini', model), 'writing rates'), inputTokens, 150)).toMatchObject({ inputCostPer1MCents: 150, outputCostPer1MCents: 750 })
      expect(computeTokenCost(ocrRates, inputTokens, 150)).toMatchObject({ inputCostPer1MCents: 150, outputCostPer1MCents: 750 })
      const billing = computeGeminiSttBillingFromUsage(model, {
        promptTokenCount: inputTokens,
        candidatesTokenCount: 100,
        thoughtsTokenCount: 50,
        promptTokensDetails: [{ modality: 'AUDIO', tokenCount: inputTokens / 2 }]
      })
      expect(billing?.totalCost).toBeCloseTo(inputTokens * 150 / 1_000_000 + 150 * 750 / 1_000_000)
      expect(billing?.outputTokens).toBe(150)
      expect(billing?.audioInputTokens).toBe(inputTokens / 2)
      expect(billing?.textInputTokens).toBe(inputTokens / 2)
    }
    const registry = getModelRegistry()
    for (const entry of [registry.llm['gemini']?.models[model], registry.extract['gemini']?.models[model], registry.stt['gemini-stt']?.models[model]]) {
      expect(entry?.pricingCheckedAt).toBe('2026-09-08')
      expect(entry?.pricingNotes).toContain('2026-12-31')
      expect(entry?.pricingNotes).toContain('2027-01-01')
      expect(entry?.pricingNotes).toContain('Automatic date transitions are unsupported')
    }
    expect(registry.stt['gemini-stt']?.models[model]?.costPerHourCents).toBe(17.28)
    expect(computeGeminiSttBillingFromUsage(model, undefined)).toBeUndefined()
    expect(computeGeminiSttBillingFromUsage('gemini-3.6-flash', { promptTokenCount: 1_000_000 })?.totalCost).toBe(150)
  })
})
