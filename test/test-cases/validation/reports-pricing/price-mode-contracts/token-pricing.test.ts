import { describe, expect, test } from 'bun:test'
import { getExtractPricing, getLlmCost, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import type { Step3Metadata } from '~/types'

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
  test('shared token pricing helper computes flat cents-per-million rates', () => {
      const cost = computeTokenCost({
        inputCostPer1MCents: 20,
        outputCostPer1MCents: 125
      }, 1_000_000, 1_000_000)

      expect(cost).toMatchObject({
        inputCostPer1MCents: 20,
        outputCostPer1MCents: 125,
        inputCost: 20,
        outputCost: 125,
        totalCost: 145,
        costMultiplier: 1
      })
    })

  test('shared token pricing helper applies OpenAI long-context bands', () => {
      const rates = getLlmCost('openai', 'gpt-5.5')
      if (!rates) {
        throw new Error('Missing GPT-5.5 pricing')
      }

      const shortContext = computeTokenCost(rates, 200_000, 10_000)
      expect(shortContext).toMatchObject({
        pricingBand: 'standard-short-context',
        inputCostPer1MCents: 500,
        outputCostPer1MCents: 3000,
        totalCost: 130
      })

      const longContext = computeTokenCost(rates, 300_000, 10_000)
      expect(longContext).toMatchObject({
        pricingBand: 'standard-long-context',
        inputCostPer1MCents: 1000,
        outputCostPer1MCents: 4500,
        totalCost: 345
      })
    })

  test('shared token pricing helper applies Gemini Pro 200K bands', () => {
      const rates = getLlmCost('gemini', 'gemini-3.1-pro-preview')
      if (!rates) {
        throw new Error('Missing Gemini 3.1 Pro pricing')
      }

      const standard = computeTokenCost(rates, 200_000, 1000)
      const over200k = computeTokenCost(rates, 200_001, 1000)

      expect(standard).toMatchObject({
        pricingBand: 'standard-up-to-200k',
        inputCostPer1MCents: 200,
        outputCostPer1MCents: 1200
      })
      expect(over200k).toMatchObject({
        pricingBand: 'standard-over-200k',
        inputCostPer1MCents: 400,
        outputCostPer1MCents: 1800
      })
      expect(over200k.totalCost).toBeCloseTo(81.8004)
    })

  test('shared token pricing helper applies MiniMax M3 512K bands and registry provenance', () => {
      const rates = getLlmCost('minimax', 'MiniMax-M3')
      if (!rates) {
        throw new Error('Missing MiniMax-M3 pricing')
      }

      const standard = computeTokenCost(rates, 512_000, 1000)
      const over512k = computeTokenCost(rates, 512_001, 1000)

      expect(standard).toMatchObject({
        pricingBand: 'standard-up-to-512k',
        inputCostPer1MCents: 60,
        outputCostPer1MCents: 240
      })
      expect(standard.totalCost).toBeCloseTo(30.96)
      expect(over512k).toMatchObject({
        pricingBand: 'standard-over-512k',
        inputCostPer1MCents: 120,
        outputCostPer1MCents: 480
      })
      expect(over512k.totalCost).toBeCloseTo(61.92012)

      const entry = getModelRegistry().llm['minimax']?.models['MiniMax-M3']
      if (!entry) {
        throw new Error('Missing MiniMax-M3 registry entry')
      }
      expect(entry.pricingSourceUrl).toBe('https://platform.minimax.io/docs/guides/pricing-paygo')
      expect(entry.pricingCheckedAt).toBe('2026-05-31')
      expect(entry.pricingTier).toBe('MiniMax pay-as-you-go standard pricing')
      expect(entry.pricingNotes).toContain('7-day promotional discount')
      expect(entry.pricingNotes).toContain('priority pricing')
      expect(entry.tokenPricingBands?.[0]).toMatchObject({
        label: 'standard-up-to-512k',
        cachedInputCostPer1MUSD: 0.12,
        cachedInputCostPer1MCents: 12
      })
      expect(entry.tokenPricingBands?.[1]).toMatchObject({
        label: 'standard-over-512k',
        cachedInputCostPer1MUSD: 0.24,
        cachedInputCostPer1MCents: 24
      })
    })

  test('shared token pricing helper emits xAI higher-context notes without inventing rates', () => {
      const rates = getLlmCost('grok', 'grok-4.3')
      if (!rates) {
        throw new Error('Missing Grok 4.3 pricing')
      }

      const cost = computeTokenCost(rates, 200_001, 1000)

      expect(cost).toMatchObject({
        inputCostPer1MCents: 125,
        outputCostPer1MCents: 250
      })
      expect(cost.pricingNote).toContain('higher context pricing')
    })

  test('Grok 4.5 LLM pricing uses published short and long context bands', () => {
      const rates = getLlmCost('grok', 'grok-4.5')
      const entry = getModelRegistry().llm['grok']?.models['grok-4.5']
      if (!rates || !entry) {
        throw new Error('Missing Grok 4.5 LLM pricing')
      }

      expect(computeTokenCost(rates, 200_000, 1000)).toMatchObject({
        pricingBand: 'standard-up-to-200k',
        inputCostPer1MCents: 200,
        outputCostPer1MCents: 600,
        totalCost: 40.6
      })
      expect(computeTokenCost(rates, 200_001, 1000)).toMatchObject({
        pricingBand: 'standard-over-200k',
        inputCostPer1MCents: 400,
        outputCostPer1MCents: 1200
      })
      expect(computeTokenCost(rates, 200_001, 1000).totalCost).toBeCloseTo(81.2004)
      expect(entry).toMatchObject({
        pricingCheckedAt: '2026-07-23',
        inputCostPer1MUSD: 2,
        inputCostPer1MCents: 200,
        cachedInputCostPer1MUSD: 0.3,
        cachedInputCostPer1MCents: 30,
        outputCostPer1MUSD: 6,
        outputCostPer1MCents: 600,
        estimation: {
          msPer1KTokens: 11318,
          costMultiplier: 1
        }
      })
      expect(entry.tokenPricingBands?.[1]).toMatchObject({
        cachedInputCostPer1MUSD: 0.6,
        cachedInputCostPer1MCents: 60
      })
    })

  test('Grok 4.5 OCR pricing uses published short and long context bands', () => {
      const rates = getExtractPricing('grok', 'grok-4.5')
      const entry = getModelRegistry().extract['grok']?.models['grok-4.5']
      if (!entry || rates.inputCostPer1MCents === undefined || rates.outputCostPer1MCents === undefined) {
        throw new Error('Missing Grok 4.5 OCR pricing')
      }

      expect(computeTokenCost({
        ...rates,
        inputCostPer1MCents: rates.inputCostPer1MCents,
        outputCostPer1MCents: rates.outputCostPer1MCents
      }, 200_000, 1000)).toMatchObject({
        pricingBand: 'standard-up-to-200k',
        inputCostPer1MCents: 200,
        outputCostPer1MCents: 600
      })
      expect(computeTokenCost({
        ...rates,
        inputCostPer1MCents: rates.inputCostPer1MCents,
        outputCostPer1MCents: rates.outputCostPer1MCents
      }, 200_001, 1000)).toMatchObject({
        pricingBand: 'standard-over-200k',
        inputCostPer1MCents: 400,
        outputCostPer1MCents: 1200
      })
      expect(entry).toMatchObject({
        pricingCheckedAt: '2026-07-23',
        costPerMInputTokensUSD: 2,
        costPerMInputTokensCents: 200,
        costPerMCachedInputTokensUSD: 0.3,
        costPerMCachedInputTokensCents: 30,
        costPerMOutputTokensUSD: 6,
        costPerMOutputTokensCents: 600
      })
      expect(entry.tokenPricingBands?.[1]).toMatchObject({
        cachedInputCostPer1MUSD: 0.6,
        cachedInputCostPer1MCents: 60
      })
      expect(entry.higherContextPricing).toBeUndefined()
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
        cachedInputCostPer1MUSD: 0.2,
        cachedInputCostPer1MCents: 20
      })
      expect(glmEntry).toMatchObject({
        pricingSourceUrl: 'https://docs.together.ai/docs/inference/pricing',
        cachedInputCostPer1MUSD: 0.26,
        cachedInputCostPer1MCents: 26
      })
    })

  test('LLM preflight and actual costs use the same context-tier helper', () => {
      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        llmTargets: [{
          service: 'openai',
          model: 'gpt-5.5',
          inputTokens: 300_000,
          outputTokens: 10_000
        }]
      })
      const actual = computeActualCosts({
        step3: buildStep3CostMetadata()
      })

      expect(estimated.steps[0]).toMatchObject({
        step: 'llm',
        provider: 'openai',
        model: 'gpt-5.5',
        cost: 345,
        pricingBand: 'standard-long-context'
      })
      expect(actual.steps[0]).toMatchObject({
        step: 'llm',
        provider: 'openai',
        model: 'gpt-5.5',
        cost: 345,
        costSource: 'provider_usage',
        pricingBand: 'standard-long-context'
      })
      expect(actual.totalCost).toBe(estimated.totalCost)
    })

  test('Grok 4.5 LLM preflight and actual costs propagate the long-context band', () => {
      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        llmTargets: [{
          service: 'grok',
          model: 'grok-4.5',
          inputTokens: 200_001,
          outputTokens: 1000
        }]
      })
      const actual = computeActualCosts({
        step3: buildStep3CostMetadata({
          llmService: 'grok',
          llmModel: 'grok-4.5',
          inputTokenCount: 200_001,
          outputTokenCount: 1000
        })
      })

      expect(estimated.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.5',
        cost: 81.2004,
        pricingBand: 'standard-over-200k'
      })
      expect(actual.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.5',
        cost: 81.2004,
        pricingBand: 'standard-over-200k'
      })
      expect(actual.totalCost).toBeCloseTo(estimated.totalCost)
    })

  test('token-priced OCR estimates and actuals use the shared context-tier helper', () => {
      const extractTargets = [{
        provider: 'gemini' as const,
        model: 'gemini-3.1-pro-preview',
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
          extractionMethod: 'pdf+gemini-ocr',
          totalPages: 1,
          ocrPages: 1,
          textPages: 0,
          processingTime: 1234,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 201_001,
          ocrService: 'gemini',
          ocrModel: 'gemini-3.1-pro-preview',
          promptTokens: 200_001,
          completionTokens: 1000
        }
      })

      expect(estimated.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'gemini',
        model: 'gemini-3.1-pro-preview',
        pricingBand: 'standard-over-200k'
      })
      expect(actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'gemini',
        model: 'gemini-3.1-pro-preview',
        pricingBand: 'standard-over-200k'
      })
      expect(estimated.steps[0]?.cost).toBeCloseTo(81.8004)
      expect(actual.steps[0]?.cost).toBeCloseTo(81.8004)
      expect(actual.totalCost).toBeCloseTo(estimated.totalCost)
    })

  test('Grok 4.5 OCR estimates and actuals propagate the long-context band', () => {
      const extractTargets = [{
        provider: 'grok' as const,
        model: 'grok-4.5',
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
          extractionMethod: 'pdf+grok-ocr',
          totalPages: 1,
          ocrPages: 1,
          textPages: 0,
          processingTime: 1234,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 201_001,
          ocrService: 'grok',
          ocrModel: 'grok-4.5',
          promptTokens: 200_001,
          completionTokens: 1000
        }
      })

      expect(estimated.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.5',
        cost: 81.2004,
        pricingBand: 'standard-over-200k'
      })
      expect(actual.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.5',
        cost: 81.2004,
        pricingBand: 'standard-over-200k'
      })
      expect(actual.totalCost).toBeCloseTo(estimated.totalCost)
    })

  test('current Gemini, Claude, and Kimi additions use published flat rates without context bands', () => {
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

      for (const [service, model] of [
        ['gemini', 'gemini-3.6-flash'],
        ['gemini', 'gemini-3.5-flash'],
        ['gemini', 'gemini-3.5-flash-lite'],
        ['anthropic', 'claude-opus-5'],
        ['kimi', 'kimi-k3']
      ] as const) {
        expect(getLlmCost(service, model)?.tokenPricingBands).toBeUndefined()
      }

      const kimiK3 = getModelRegistry().llm['kimi']?.models['kimi-k3']
      if (!kimiK3) {
        throw new Error('Missing Kimi K3 registry entry')
      }
      expect(kimiK3).toMatchObject({
        pricingSourceUrl: 'https://platform.kimi.ai/docs/pricing/chat-k3',
        cachedInputCostPer1MUSD: 0.3,
        cachedInputCostPer1MCents: 30
      })
    })

  test('current OCR additions register published rates for document extraction', () => {
      expect(getExtractPricing('gemini', 'gemini-3.6-flash')).toMatchObject({
        inputCostPer1MCents: 150,
        outputCostPer1MCents: 750
      })
      expect(getExtractPricing('gemini', 'gemini-3.5-flash-lite')).toMatchObject({
        inputCostPer1MCents: 30,
        outputCostPer1MCents: 250
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

  test('current model additions do not displace any cheapest-model default', () => {
      expect(resolveCheapestModelForFlag('gemini')).toBe('gemini-3.1-flash-lite')
      expect(resolveCheapestModelForFlag('anthropic')).toBe('claude-haiku-4-5')
      expect(resolveCheapestModelForFlag('kimi')).toBe('kimi-k2.6')
      expect(resolveCheapestModelForFlag('gemini-ocr')).toBe('gemini-3.1-flash-lite')
      expect(resolveCheapestModelForFlag('anthropic-ocr')).toBe('claude-haiku-4-5')
      expect(resolveCheapestModelForFlag('kimi-ocr')).toBe('kimi-k2.6')
    })
})
