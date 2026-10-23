import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { getExtractPricing,getLlmCost,getModelRegistry,getRetiredModelRate } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { Step3Metadata } from '~/types'
import { requireDefined } from '../../../../test-utils/value-assertions'

const buildStep3CostMetadata = (overrides: Partial<Step3Metadata> = {}): Step3Metadata => ({
  llmService: 'openai',
  llmModel: 'gpt-6.1-sol',
  processingTime: 1234,
  inputTokenCount: 300_000,
  outputTokenCount: 10_000,
  tokenCountSource: 'provider_usage',
  outputFileName: 'output.json',
  outputFormat: 'json',
  structuredMode: 'native',
  structuredPresetNames: [],
  ...overrides
})

describe('price mode contracts', () => {

  test('GPT-6.1 Sol write and OCR and historical Grok 4.5 resolve through tariff accessors', () => {
      expect(getLlmCost('openai', 'gpt-6.1-sol')).toMatchObject({
        inputCostPer1MCents: 200,
        outputCostPer1MCents: 1000
      })
      for (const removed of ['gpt-6-astra', 'gpt-5.6-terra']) {
        expect(getModelRegistry().llm['openai']?.models[removed]).toBeUndefined()
        expect(getModelRegistry().extract['openai']?.models[removed]).toBeUndefined()
        expect(getRetiredModelRate('llm', 'openai', removed)).toBeUndefined()
      }
      expect(getExtractPricing('openai', 'gpt-6.1-sol')).toMatchObject({
        inputCostPer1MCents: 200,
        cachedInputCostPer1MCents: 10,
        outputCostPer1MCents: 1000
      })
      expect(getLlmCost('grok', 'grok-4.5')).toMatchObject({
        inputCostPer1MCents: 200,
        outputCostPer1MCents: 600
      })
      expect(getExtractPricing('grok', 'grok-4.7')).toMatchObject({
        inputCostPer1MCents: 200,
        cachedInputCostPer1MCents: 50,
        outputCostPer1MCents: 600
      })
      expect(getModelRegistry().extract['grok']?.models['grok-4.5']).toBeUndefined()
      expect(getModelRegistry().llm['openai']?.models['gpt-6.1-sol']?.cachedInputCostPer1MCents).toBe(10)
      expect(getRetiredModelRate('llm', 'grok', 'grok-4.5')?.cachedInputCostPer1MCents).toBe(30)
      expect(getModelRegistry().llm['grok']?.models['grok-4.5']).toBeUndefined()
    })

  test('historical LLM receipts retain frozen rates through preflight', () => {
      expect(getLlmCost('gemini', 'gemini-3.6-flash')).toMatchObject({
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 750
      })

      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        llmTargets: [{
          service: 'gemini',
          model: 'gemini-3.6-flash',
          inputTokens: 1_000_000,
          outputTokens: 1_000_000
        }]
      })

      expect(estimated.steps[0]).toMatchObject({
        step: 'llm',
        provider: 'gemini',
        model: 'gemini-3.6-flash',
        cost: 900,
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 750
      })
      expect(getRetiredModelRate('llm', 'gemini', 'gemini-3.6-flash')).toBeDefined()
      expect(getModelRegistry().llm['gemini']?.models['gemini-3.6-flash']).toBeUndefined()
    })

  const TOKEN_PRICED_OCR_CASES = [
    {
      name: 'token-priced OCR estimates and actuals use the shared context-tier helper',
      provider: 'gemini' as const,
      model: 'gemini-3.8-flash',
      extractionMethod: 'pdf+gemini-ocr' as const,
      expectedCost: 30.75015
    },
    {
      name: 'Grok 4.7 OCR estimates and actuals propagate the long-context band',
      provider: 'grok' as const,
      model: 'grok-4.7',
      extractionMethod: 'pdf+grok-ocr' as const,
      expectedCost: 81.2004
    }
  ]

  for (const testCase of TOKEN_PRICED_OCR_CASES) {
    test(testCase.name, () => {
      const extractTargets = [{
        provider: testCase.provider,
        model: testCase.model,
        pageCount: 1,
        promptTokens: 200_001,
        completionTokens: 1000,
        estimateType: 'exact' as const
      }]
      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        extractTargets
      })
      const actual = computeActualCosts({
        step2: {
          extractionMethod: testCase.extractionMethod,
          totalPages: 1,
          ocrPages: 1,
          textPages: 0,
          processingTime: 1234,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 201_001,
          ocrService: testCase.provider,
          ocrModel: testCase.model,
          promptTokens: 200_001,
          completionTokens: 1000
        }
      })

      const expected = {
        step: 'extract',
        provider: testCase.provider,
        model: testCase.model,
        ...(testCase.provider === 'grok' ? { pricingBand: 'standard-at-least-200k' } : {})
      }
      expect(estimated.steps[0]).toMatchObject(expected)
      expect(actual.steps[0]).toMatchObject(expected)
      expect(estimated.steps[0]?.cost).toBeCloseTo(testCase.expectedCost)
      expect(actual.steps[0]?.cost).toBeCloseTo(testCase.expectedCost)
      expect(actual.totalCost).toBeCloseTo(estimated.totalCost)
    })
  }
  test('current and historical Gemini and Claude rates use published flat rates without context bands', () => {
      expect(getLlmCost('gemini', 'gemini-3.6-flash')).toMatchObject({
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 750
      })
      expect(getLlmCost('anthropic', 'claude-fable-5')).toMatchObject({
        inputCostPer1MCents: 1000,
        outputCostPer1MCents: 5000
      })
      expect(getExtractPricing('gemini', 'gemini-3.8-flash')).toMatchObject({
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 750
      })
      expect(getExtractPricing('gemini', 'gemini-3.8-flash').tokenPricingBands).toBeUndefined()
      expect(getExtractPricing('anthropic', 'claude-fable-5')).toMatchObject({
        inputCostPer1MCents: 1000,
        outputCostPer1MCents: 5000
      })
      for (const [service, model] of [
        ['gemini', 'gemini-3.6-flash'],
        ['gemini', 'gemini-3.5-flash'],
        ['grok', 'grok-4.5'],
        ['anthropic', 'claude-fable-5']
      ] as const) {
        expect(getModelRegistry().llm[service]?.models[model]).toBeUndefined()
      }

      const geminiActual = computeActualCosts({
        step3: buildStep3CostMetadata({
          llmService: 'gemini',
          llmModel: 'gemini-3.6-flash',
          inputTokenCount: 1_000_000,
          outputTokenCount: 1_000_000
        })
      })
      expect(geminiActual.steps[0]).toMatchObject({
        provider: 'gemini',
        model: 'gemini-3.6-flash',
        cost: 900,
        costSource: 'provider_usage'
      })

      for (const [service, model] of [
        ['gemini', 'gemini-3.6-flash'],
        ['anthropic', 'claude-fable-5']
      ] as const) {
        expect(getLlmCost(service, model)?.tokenPricingBands).toBeUndefined()
      }

      const voxtralMini = requireDefined(getModelRegistry().stt['mistral']?.models['voxtral-mini-2602'], 'Voxtral Mini registry entry')
      expect(voxtralMini).toMatchObject({
        costPerHourCents: 18,
        pricingCheckedAt: '2026-09-15'
      })
    })

  test('current and historical OCR targets retain published rates for document extraction', () => {
      expect(getExtractPricing('gemini', 'gemini-3.8-flash')).toMatchObject({
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 750
      })
      expect(getExtractPricing('anthropic', 'claude-sonnet-5-5')).toMatchObject({
        inputCostPer1MCents: 200,
        cachedInputCostPer1MCents: 10,
        outputCostPer1MCents: 1000
      })
      expect(getExtractPricing('anthropic', 'claude-opus-5-5')).toMatchObject({
        inputCostPer1MCents: 400,
        cachedInputCostPer1MCents: 20,
        outputCostPer1MCents: 2000
      })
      expect(getExtractPricing('anthropic', 'claude-fable-5')).toMatchObject({
        inputCostPer1MCents: 1000,
        outputCostPer1MCents: 5000
      })
    })
})
