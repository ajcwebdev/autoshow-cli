import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { getExtractPricing,getLlmCost,getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { Step3Metadata } from '~/types'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { requireDefined } from '../../../../test-utils/value-assertions'

const buildStep3CostMetadata = (overrides: Partial<Step3Metadata> = {}): Step3Metadata => ({
  llmService: 'openai',
  llmModel: 'gpt-5.6-sol',
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
  test('Astra pricing changes for the whole request strictly above 272K input tokens', () => {
    const rates = requireDefined(getLlmCost('openai', 'gpt-6-astra'), 'Astra pricing')
    const standard = computeTokenCost(rates, 272_000, 1000)
    const long = computeTokenCost(rates, 272_001, 1000)
    expect(standard).toMatchObject({ inputCostPer1MCents: 1000, outputCostPer1MCents: 5000, totalCost: 277 })
    expect(long).toMatchObject({ inputCostPer1MCents: 2000, outputCostPer1MCents: 7500 })
    expect(long.totalCost).toBeCloseTo(551.502)
    const entry = requireDefined(getModelRegistry().llm['openai']?.models['gpt-6-astra'], 'Astra registry entry')
    expect(entry.tokenPricingBands?.map((band) => band.cachedInputCostPer1MCents)).toEqual([100, 200])
  })

  const GROK_LLM_BAND_CASES = [
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

  test('Grok 4.6 LLM preflight and actual costs propagate the long-context band', () => {
      const estimated = computeEstimatedCosts({
        applyCostMultipliers: false,
        llmTargets: [{
          service: 'grok',
          model: 'grok-4.6',
          inputTokens: 200_001,
          outputTokens: 1000
        }]
      })
      const actual = computeActualCosts({
        step3: buildStep3CostMetadata({
          llmService: 'grok',
          llmModel: 'grok-4.6',
          inputTokenCount: 200_001,
          outputTokenCount: 1000
        })
      })

      expect(estimated.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.6',
        cost: 81.2004,
        pricingBand: 'standard-over-200k'
      })
      expect(actual.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.6',
        cost: 81.2004,
        pricingBand: 'standard-over-200k'
      })
      expect(actual.totalCost).toBeCloseTo(estimated.totalCost)
    })
})
