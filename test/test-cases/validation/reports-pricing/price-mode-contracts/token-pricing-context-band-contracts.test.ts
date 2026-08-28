import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { getExtractPricing,getLlmCost,getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { Step3Metadata } from '~/types'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
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

  test('shared token pricing helper applies OpenAI long-context bands', () => {
      const rates = requireDefined(getLlmCost('openai', 'gpt-5.5'), 'GPT-5.5 pricing')

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
      const rates = requireDefined(getLlmCost('gemini', 'gemini-3.1-pro-preview'), 'Gemini 3.1 Pro pricing')

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
      const rates = requireDefined(getLlmCost('minimax', 'MiniMax-M3'), 'MiniMax-M3 pricing')

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

      const entry = requireDefined(getModelRegistry().llm['minimax']?.models['MiniMax-M3'], 'MiniMax-M3 registry entry')
      expect(entry.pricingSourceUrl).toBe('https://platform.minimax.io/docs/guides/pricing-paygo')
      expect(entry.pricingCheckedAt).toBe('2026-05-31')
      expect(entry.pricingTier).toBe('MiniMax pay-as-you-go standard pricing')
      expect(entry.pricingNotes).toContain('7-day promotional discount')
      expect(entry.pricingNotes).toContain('priority pricing')
      expect(entry.tokenPricingBands?.[0]).toMatchObject({
        label: 'standard-up-to-512k',
        cachedInputCostPer1MCents: 12
      })
      expect(entry.tokenPricingBands?.[1]).toMatchObject({
        label: 'standard-over-512k',
        cachedInputCostPer1MCents: 24
      })
    })

  test('shared token pricing helper emits xAI higher-context notes without inventing rates', () => {
      const rates = requireDefined(getLlmCost('grok', 'grok-4.3'), 'Grok 4.3 pricing')

      const cost = computeTokenCost(rates, 200_001, 1000)

      expect(cost).toMatchObject({
        inputCostPer1MCents: 125,
        outputCostPer1MCents: 250
      })
      expect(cost.pricingNote).toContain('higher context pricing')
    })

  const GROK_LLM_BAND_CASES = [
    { model: 'grok-4.5', pricingCheckedAt: '2026-07-23', cachedInputCostPer1MCents: 30, longBandCachedInputCostPer1MCents: 60 },
    { model: 'grok-4.6', pricingCheckedAt: '2026-08-18', cachedInputCostPer1MCents: 50, longBandCachedInputCostPer1MCents: 100 }
  ]

  for (const testCase of GROK_LLM_BAND_CASES) {
    test(`Grok ${testCase.model.replace('grok-', '')} LLM pricing uses published short and long context bands`, () => {
      const rates = getLlmCost('grok', testCase.model)
      const entry = getModelRegistry().llm['grok']?.models[testCase.model]
      if (!rates || !entry) {
        throw new Error(`Missing ${testCase.model} LLM pricing`)
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
        pricingCheckedAt: testCase.pricingCheckedAt,
        inputCostPer1MCents: 200,
        cachedInputCostPer1MCents: testCase.cachedInputCostPer1MCents,
        outputCostPer1MCents: 600,
        estimation: {
          msPer1KTokens: 11318,
          costMultiplier: 1
        }
      })
      expect(entry.tokenPricingBands?.[1]).toMatchObject({
        cachedInputCostPer1MCents: testCase.longBandCachedInputCostPer1MCents
      })
    })
  }

  const GROK_OCR_BAND_CASES = [
    { model: 'grok-4.5', pricingCheckedAt: '2026-07-23', cachedInputCostPer1MCents: 30, longBandCachedInputCostPer1MCents: 60 },
    { model: 'grok-4.6', pricingCheckedAt: '2026-08-18', cachedInputCostPer1MCents: 50, longBandCachedInputCostPer1MCents: 100 }
  ]

  for (const testCase of GROK_OCR_BAND_CASES) {
    test(`Grok ${testCase.model.replace('grok-', '')} OCR pricing uses published short and long context bands`, () => {
      const rates = getExtractPricing('grok', testCase.model)
      const entry = getModelRegistry().extract['grok']?.models[testCase.model]
      if (!entry || rates.inputCostPer1MCents === undefined || rates.outputCostPer1MCents === undefined) {
        throw new Error(`Missing ${testCase.model} OCR pricing`)
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
        pricingCheckedAt: testCase.pricingCheckedAt,
        costPerMInputTokensCents: 200,
        costPerMCachedInputTokensCents: testCase.cachedInputCostPer1MCents,
        costPerMOutputTokensCents: 600
      })
      expect(entry.tokenPricingBands?.[1]).toMatchObject({
        cachedInputCostPer1MCents: testCase.longBandCachedInputCostPer1MCents
      })
      expect(entry.higherContextPricing).toBeUndefined()
    })
  }

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
})
