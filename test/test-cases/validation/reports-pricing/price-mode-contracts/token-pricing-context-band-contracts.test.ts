import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { getExtractPricing,getLlmCost,getModelRegistry,getRetiredModelRate } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { Step3Metadata } from '~/types'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
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
  test('GPT-6 Luna pricing changes for the whole request strictly above 272K input tokens', () => {
    const rates = requireDefined(getLlmCost('openai', 'gpt-6-luna'), 'GPT-6 Luna pricing')
    const standard = computeTokenCost(rates, 272_000, 1000)
    const long = computeTokenCost(rates, 272_001, 1000)
    expect(standard).toMatchObject({ inputCostPer1MCents: 10, outputCostPer1MCents: 50 })
    expect(standard.totalCost).toBeCloseTo(2.77)
    expect(long).toMatchObject({ inputCostPer1MCents: 20, outputCostPer1MCents: 75 })
    expect(long.totalCost).toBeCloseTo(5.51502)
    const entry = requireDefined(getModelRegistry().llm['openai']?.models['gpt-6-luna'], 'GPT-6 Luna registry entry')
    expect(entry.tokenPricingBands?.map((band) => band.cachedInputCostPer1MCents)).toEqual([1, 2])
  })

  const GROK_LLM_BAND_CASES = [
    { model: 'grok-4.5', cachedInputCostPer1MCents: 30, longBandCachedInputCostPer1MCents: 60 }
  ]

  for (const testCase of GROK_LLM_BAND_CASES) {
    test(`Grok ${testCase.model.replace('grok-', '')} LLM pricing uses published short and long context bands`, () => {
      const rates = getLlmCost('grok', testCase.model)
      const entry = getRetiredModelRate('llm', 'grok', testCase.model)
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
        inputCostPer1MCents: 200,
        cachedInputCostPer1MCents: testCase.cachedInputCostPer1MCents,
        outputCostPer1MCents: 600
      })
      expect(getModelRegistry().llm['grok']?.models[testCase.model]).toBeUndefined()
      expect(entry.tokenPricingBands?.[1]).toMatchObject({
        cachedInputCostPer1MCents: testCase.longBandCachedInputCostPer1MCents
      })
    })
  }

  test('Grok 4.7 OCR pricing switches to the long-context band at 200K input tokens', () => {
      const rates = getExtractPricing('grok', 'grok-4.7')
      const entry = requireDefined(getModelRegistry().extract['grok']?.models['grok-4.7'], 'Grok 4.7 OCR registry entry')
      if (rates.inputCostPer1MCents === undefined || rates.outputCostPer1MCents === undefined) {
        throw new Error('Missing grok-4.7 OCR pricing')
      }
      const tokenRates = { ...rates, inputCostPer1MCents: rates.inputCostPer1MCents, outputCostPer1MCents: rates.outputCostPer1MCents }

      expect(computeTokenCost(tokenRates, 199_999, 1000)).toMatchObject({
        pricingBand: 'standard-below-200k',
        inputCostPer1MCents: 200,
        outputCostPer1MCents: 600
      })
      expect(computeTokenCost(tokenRates, 200_000, 1000)).toMatchObject({
        pricingBand: 'standard-at-least-200k',
        inputCostPer1MCents: 400,
        outputCostPer1MCents: 1200
      })
      expect(entry).toMatchObject({
        pricingCheckedAt: '2026-10-17',
        costPerMInputTokensCents: 200,
        costPerMCachedInputTokensCents: 50,
        costPerMOutputTokensCents: 600
      })
      expect(entry.tokenPricingBands?.[1]).toMatchObject({ cachedInputCostPer1MCents: 100 })
      expect(rates).not.toHaveProperty('higherContextPricing')
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

  const OPENAI_BAND_CASES = [
    {
      model: 'gpt-6-luna',
      ocr: true,
      shortInput: 10,
      shortCached: 1,
      shortOutput: 50,
      longInput: 20,
      longCached: 2,
      longOutput: 75
    },
    {
      model: 'gpt-6.1-sol',
      ocr: true,
      shortInput: 200,
      shortCached: 10,
      shortOutput: 1000,
      longInput: 400,
      longCached: 20,
      longOutput: 1500
    }
  ] as const

  for (const testCase of OPENAI_BAND_CASES) {
    test(`OpenAI ${testCase.model} LLM pricing uses published short and long context bands`, () => {
      const rates = requireDefined(getLlmCost('openai', testCase.model), `${testCase.model} LLM pricing`)
      const standard = computeTokenCost(rates, 272_000, 1000)
      const long = computeTokenCost(rates, 272_001, 1000)

      expect(standard).toMatchObject({
        pricingBand: 'standard-short-context',
        inputCostPer1MCents: testCase.shortInput,
        outputCostPer1MCents: testCase.shortOutput
      })
      expect(long).toMatchObject({
        pricingBand: 'standard-long-context',
        inputCostPer1MCents: testCase.longInput,
        outputCostPer1MCents: testCase.longOutput
      })

      const entry = requireDefined(getModelRegistry().llm['openai']?.models[testCase.model] ?? getRetiredModelRate('llm', 'openai', testCase.model), `${testCase.model} active or historical LLM pricing`)
      expect(entry.tokenPricingBands?.map((band) => band.cachedInputCostPer1MCents)).toEqual([
        testCase.shortCached,
        testCase.longCached
      ])
    })

    if (testCase.ocr) test(`OpenAI ${testCase.model} OCR pricing uses published short and long context bands`, () => {
      const rates = getExtractPricing('openai', testCase.model)
      const entry = requireDefined(getModelRegistry().extract['openai']?.models[testCase.model] ?? getRetiredModelRate('extract', 'openai', testCase.model), `${testCase.model} active or historical OCR pricing`)

      if (rates.inputCostPer1MCents === undefined || rates.outputCostPer1MCents === undefined) {
        throw new Error(`Missing ${testCase.model} OCR rates`)
      }

      const standard = computeTokenCost({
        ...rates,
        inputCostPer1MCents: rates.inputCostPer1MCents,
        outputCostPer1MCents: rates.outputCostPer1MCents
      }, 272_000, 1000)
      const long = computeTokenCost({
        ...rates,
        inputCostPer1MCents: rates.inputCostPer1MCents,
        outputCostPer1MCents: rates.outputCostPer1MCents
      }, 272_001, 1000)

      expect(standard).toMatchObject({
        pricingBand: 'standard-short-context',
        inputCostPer1MCents: testCase.shortInput,
        outputCostPer1MCents: testCase.shortOutput
      })
      expect(long).toMatchObject({
        pricingBand: 'standard-long-context',
        inputCostPer1MCents: testCase.longInput,
        outputCostPer1MCents: testCase.longOutput
      })
      expect(entry.tokenPricingBands?.map((band) => band.cachedInputCostPer1MCents)).toEqual([
        testCase.shortCached,
        testCase.longCached
      ])
    })
  }

  test('GPT-6 Luna LLM preflight and actual costs propagate the long-context band', () => {
    const estimated = computeEstimatedCosts({
      applyCostMultipliers: false,
      llmTargets: [{
        service: 'openai',
        model: 'gpt-6-luna',
        inputTokens: 272_001,
        outputTokens: 1000
      }]
    })
    const actual = computeActualCosts({
      step3: buildStep3CostMetadata({
        llmService: 'openai',
        llmModel: 'gpt-6-luna',
        inputTokenCount: 272_001,
        outputTokenCount: 1000
      })
    })

    const expectedCost = (272_001 / 1_000_000) * 20 + (1000 / 1_000_000) * 75
    expect(estimated.steps[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-6-luna',
      pricingBand: 'standard-long-context'
    })
    expect(estimated.steps[0]?.cost).toBeCloseTo(expectedCost)
    expect(actual.steps[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-6-luna',
      pricingBand: 'standard-long-context'
    })
    expect(actual.steps[0]?.cost).toBeCloseTo(expectedCost)
    expect(actual.totalCost).toBeCloseTo(estimated.totalCost)
  })
})
