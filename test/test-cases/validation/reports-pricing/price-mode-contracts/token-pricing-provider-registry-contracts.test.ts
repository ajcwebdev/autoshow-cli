import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { getExtractPricing,getLlmCost,getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { Step3Metadata } from '~/types'
import { requireDefined } from '../../../../test-utils/value-assertions'

const buildStep3CostMetadata = (overrides: Partial<Step3Metadata> = {}): Step3Metadata => ({
  llmService: 'openai',
  llmModel: 'gpt-5.5',
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

  test('OpenAI GPT-5.6 Terra and Luna registries share current write and OCR rates', () => {
      expect(getLlmCost('openai', 'gpt-5.6-terra')).toMatchObject({
        inputCostPer1MCents: 200,
        outputCostPer1MCents: 1200
      })
      expect(getExtractPricing('openai', 'gpt-5.6-terra')).toMatchObject({
        inputCostPer1MCents: 200,
        cachedInputCostPer1MCents: 20,
        outputCostPer1MCents: 1200
      })
      expect(getLlmCost('openai', 'gpt-5.6-luna')).toMatchObject({
        inputCostPer1MCents: 20,
        outputCostPer1MCents: 120
      })
      expect(getExtractPricing('openai', 'gpt-5.6-luna')).toMatchObject({
        inputCostPer1MCents: 20,
        cachedInputCostPer1MCents: 2,
        outputCostPer1MCents: 120
      })
      expect(getModelRegistry().llm['openai']?.models['gpt-5.6-terra']?.cachedInputCostPer1MCents).toBe(20)
      expect(getModelRegistry().llm['openai']?.models['gpt-5.6-luna']?.cachedInputCostPer1MCents).toBe(2)
    })

  test('Cerebras LLM pricing uses public endpoint catalog rates', () => {
      expect(getLlmCost('cerebras', 'gpt-oss-120b')).toMatchObject({
        inputCostPer1MCents: 35,
        outputCostPer1MCents: 75
      })
      expect(getLlmCost('cerebras', 'zai-glm-4.7')).toMatchObject({
        inputCostPer1MCents: 225,
        outputCostPer1MCents: 275
      })

      const gptOssEntry = getModelRegistry().llm['cerebras']?.models['gpt-oss-120b']
      const glmEntry = getModelRegistry().llm['cerebras']?.models['zai-glm-4.7']
      if (!gptOssEntry || !glmEntry) {
        throw new Error('Missing Cerebras registry entries')
      }

      expect(gptOssEntry).toMatchObject({
        pricingSourceUrl: 'https://api.cerebras.ai/public/v1/models',
        pricingCheckedAt: '2026-06-13',
        pricingTier: 'Cerebras public endpoint token pricing'
      })
      expect(gptOssEntry.pricingNotes).toContain('$0.35/1M input tokens')
      expect(glmEntry).toMatchObject({
        pricingSourceUrl: 'https://api.cerebras.ai/public/v1/models',
        pricingCheckedAt: '2026-06-13',
        pricingTier: 'Cerebras public endpoint token pricing'
      })
      expect(glmEntry.pricingNotes).toContain('The model is marked preview')
    })

  test('Together LLM pricing uses serverless rates in estimates', () => {
      expect(getLlmCost('together', 'kimi-k2.6')).toMatchObject({
        inputCostPer1MCents: 120,
        outputCostPer1MCents: 450
      })
      expect(getLlmCost('together', 'glm-5.1')).toMatchObject({
        inputCostPer1MCents: 140,
        outputCostPer1MCents: 440
      })

      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        llmTargets: [{
          service: 'together',
          model: 'glm-5.1',
          inputTokens: 1_000_000,
          outputTokens: 1_000_000
        }]
      })

      expect(estimated.steps[0]).toMatchObject({
        step: 'llm',
        provider: 'together',
        model: 'glm-5.1',
        cost: 580,
        inputCostPer1MCents: 140,
        outputCostPer1MCents: 440
      })

      const kimiEntry = getModelRegistry().llm['together']?.models['kimi-k2.6']
      const glmEntry = getModelRegistry().llm['together']?.models['glm-5.1']
      if (!kimiEntry || !glmEntry) {
        throw new Error('Missing Together registry entries')
      }
      expect(kimiEntry).toMatchObject({
        pricingTier: 'Together AI serverless token pricing',
        cachedInputCostPer1MCents: 20
      })
      expect(glmEntry).toMatchObject({
        pricingSourceUrl: 'https://docs.together.ai/docs/inference/pricing',
        cachedInputCostPer1MCents: 26
      })
    })

  const TOKEN_PRICED_OCR_CASES = [
    {
      name: 'token-priced OCR estimates and actuals use the shared context-tier helper',
      provider: 'gemini' as const,
      model: 'gemini-3.1-pro-preview',
      extractionMethod: 'pdf+gemini-ocr' as const,
      expectedCost: 81.8004
    },
    {
      name: 'Grok 4.5 OCR estimates and actuals propagate the long-context band',
      provider: 'grok' as const,
      model: 'grok-4.5',
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
        pricingBand: 'standard-over-200k'
      }
      expect(estimated.steps[0]).toMatchObject(expected)
      expect(actual.steps[0]).toMatchObject(expected)
      expect(estimated.steps[0]?.cost).toBeCloseTo(testCase.expectedCost)
      expect(actual.steps[0]?.cost).toBeCloseTo(testCase.expectedCost)
      expect(actual.totalCost).toBeCloseTo(estimated.totalCost)
    })
  }
  test('current Gemini, Claude, and Kimi additions use published flat rates without context bands', () => {
      expect(getLlmCost('gemini', 'gemini-3.7-flash')).toMatchObject({
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 750
      })
      expect(getLlmCost('gemini', 'gemini-3.6-flash')).toMatchObject({
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 750
      })
      expect(getLlmCost('gemini', 'gemini-3.5-flash')).toMatchObject({
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 900
      })
      expect(getLlmCost('gemini', 'gemini-3.5-flash-lite')).toMatchObject({
        inputCostPer1MCents: 30,
        outputCostPer1MCents: 250
      })
      expect(getLlmCost('anthropic', 'claude-opus-5')).toMatchObject({
        inputCostPer1MCents: 500,
        outputCostPer1MCents: 2500
      })
      expect(getLlmCost('kimi', 'kimi-k3')).toMatchObject({
        inputCostPer1MCents: 300,
        outputCostPer1MCents: 1500
      })

      const geminiActual = computeActualCosts({
        step3: buildStep3CostMetadata({
          llmService: 'gemini',
          llmModel: 'gemini-3.5-flash-lite',
          inputTokenCount: 1_000_000,
          outputTokenCount: 1_000_000
        })
      })
      expect(geminiActual.steps[0]).toMatchObject({
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite',
        cost: 280,
        costSource: 'provider_usage'
      })

      for (const [service, model] of [
        ['gemini', 'gemini-3.7-flash'],
        ['gemini', 'gemini-3.6-flash'],
        ['gemini', 'gemini-3.5-flash'],
        ['gemini', 'gemini-3.5-flash-lite'],
        ['anthropic', 'claude-opus-5'],
        ['kimi', 'kimi-k3']
      ] as const) {
        expect(getLlmCost(service, model)?.tokenPricingBands).toBeUndefined()
      }

      const kimiK3 = requireDefined(getModelRegistry().llm['kimi']?.models['kimi-k3'], 'Kimi K3 registry entry')
      expect(kimiK3).toMatchObject({
        pricingSourceUrl: 'https://platform.kimi.ai/docs/pricing/chat-k3',
        cachedInputCostPer1MCents: 30
      })
    })

  test('current OCR additions register published rates for document extraction', () => {
      expect(getExtractPricing('gemini', 'gemini-3.7-flash')).toMatchObject({
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 750
      })
      expect(getExtractPricing('gemini', 'gemini-3.6-flash')).toMatchObject({
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 750
      })
      expect(getExtractPricing('gemini', 'gemini-3.5-flash-lite')).toMatchObject({
        inputCostPer1MCents: 30,
        outputCostPer1MCents: 250
      })
      expect(getExtractPricing('anthropic', 'claude-sonnet-4-6')).toMatchObject({
        inputCostPer1MCents: 300,
        outputCostPer1MCents: 1500
      })
      expect(getExtractPricing('anthropic', 'claude-opus-5')).toMatchObject({
        inputCostPer1MCents: 500,
        outputCostPer1MCents: 2500
      })
      expect(getExtractPricing('kimi', 'kimi-k3')).toMatchObject({
        inputCostPer1MCents: 300,
        cachedInputCostPer1MCents: 30,
        outputCostPer1MCents: 1500
      })
    })
})
