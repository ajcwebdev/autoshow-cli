import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { buildArticleEstimates } from '~/cli/commands/text/url/url-pricing/build-article-estimates'
import { allocatePooledOcrPages, buildExtractEstimates } from '~/cli/commands/text/ocr/ocr-pricing/build-extract-estimates'
import { getExtractEstimation, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import type { ExtractionMetadata } from '~/types'
import {
  HOSTED_OCR_PROVIDER_CASES,
  GROK_OCR_PROVIDER_CASE,
  MULTI_PAGE_PDF,
  buildHostedOcrPricingOptions,
  expectedOcrProcessingMs,
  missingHostedOcrProfilePath
} from './shared'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const expectTokenPricedOcrEstimate = (target: { provider: 'gemini' | 'openai', model: string }): void => {
  const extractTargets = [{
    provider: target.provider,
    model: target.model,
    pageCount: 2,
    promptTokens: 8000,
    completionTokens: 2000,
    estimateType: 'heuristic' as const
  }]
  const cost = computeEstimatedCosts({ extractTargets })
  const timing = computeEstimatedProcessingTimes({
    extractTargets: extractTargets.map(({ provider, model, pageCount }) => ({ provider, model, pageCount })),
    concurrencyMode: 'immediate',
    hostedOcrProfilePath: missingHostedOcrProfilePath()
  })

  expect(cost.steps[0]).toMatchObject({
    step: 'extract',
    provider: target.provider,
    model: target.model,
    promptTokens: 8000,
    completionTokens: 2000,
    pageCount: 2
  })
  expect(cost.totalCost).toBeGreaterThan(0)
  expect(timing.steps[0]).toMatchObject({
    provider: target.provider,
    model: target.model,
    processingTimeMs: expectedOcrProcessingMs(target.provider, target.model, 2)
  })
}

describe('price mode contracts', () => {
  test('active URL article estimates use Spider and Zyte page rates without fetching', () => {
    const estimates = buildArticleEstimates(
      { route: 'article', sourceKind: 'article', providers: [
        { service: 'spider', model: 'spider', origin: 'explicit' },
        { service: 'zyte', model: 'zyte', origin: 'explicit' }
      ] },
      { urlBackend: 'spider' },
      true
    )
    expect(estimates.estimates.map(({ provider, model, totalCost }) => ({ provider, model, totalCost }))).toEqual([
      { provider: 'spider', model: 'spider', totalCost: 0.12 },
      { provider: 'zyte', model: 'zyte', totalCost: 0.16 }
    ])
  })

  test('every token-priced OCR registry entry uses multiplier 1', () => {
    const registry = getModelRegistry().extract
    for (const [provider, service] of Object.entries(registry)) {
      for (const [model, metadata] of Object.entries(service.models)) {
        if (metadata.costPerMInputTokensCents === undefined || metadata.costPerMOutputTokensCents === undefined) continue
        expect(getExtractEstimation(provider, model).costMultiplier).toBe(1)
      }
    }
  })

  test('hosted OCR aggregate pricing uses detected PDF page count for every provider', async () => {
      const estimate = await buildAggregatedPriceEstimate('extract', MULTI_PAGE_PDF, buildHostedOcrPricingOptions())

      expect(estimate.steps).toHaveLength(HOSTED_OCR_PROVIDER_CASES.length)
      for (const providerCase of HOSTED_OCR_PROVIDER_CASES) {
        const step = estimate.steps.find(entry => entry.step === 'extract' && entry.provider === providerCase.provider && entry.model === providerCase.model)
        expect(step).toBeDefined()
        expect(step && 'pageCount' in step ? step.pageCount : undefined).toBe(3)
      }
  })

  test('pooled OCR pricing allocates the document once across shared provider lanes', async () => {
    const targets = [
      { service: 'openai' as const, model: 'gpt-6.1-sol' },
      { service: 'openai' as const, model: 'gpt-6-luna' },
      { service: 'gemini' as const, model: 'gemini-3.8-flash' }
    ]

    expect(allocatePooledOcrPages(10, targets)).toEqual([3, 2, 5])
    const pooled = await buildExtractEstimates(MULTI_PAGE_PDF, {
      route: 'ocr',
      sourceKind: 'pdf',
      providers: targets
    }, { ocrProviderMode: 'pool' })
    const fanout = await buildExtractEstimates(MULTI_PAGE_PDF, {
      route: 'ocr',
      sourceKind: 'pdf',
      providers: targets
    }, { ocrProviderMode: 'fanout' })

    expect(pooled.reduce((sum, step) => sum + (step.pageCount ?? 0), 0)).toBe(3)
    expect(pooled.every((step) => step.ocrProviderMode === 'pool' && step.allocationHeuristic === true && step.estimateType === 'heuristic')).toBe(true)
    expect(pooled.reduce((sum, step) => sum + step.totalCost, 0)).toBeLessThan(fanout.reduce((sum, step) => sum + step.totalCost, 0))
    expect(pooled.every((step) => step.note?.includes('actual queue share') === true)).toBe(true)
  })

  test('pooled actual cost includes failed and ambiguous paid attempts by target', () => {
    const metadata: ExtractionMetadata = {
      extractionMethod: 'ocr-pool',
      totalPages: 3,
      ocrPages: 3,
      textPages: 0,
      processingTime: 100,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 0,
      ocrProviderMode: 'pool',
      ocrPoolTargetUsage: [{
        provider: 'openai',
        model: 'gpt-6.1-sol',
        attemptedPages: 3,
        acceptedPages: 2,
        failedOrAmbiguousAttempts: 1,
        promptTokens: 3_000,
        completionTokens: 300,
        providerCostCents: 4,
        providerCostSource: 'provider_usage'
      }, {
        provider: 'mistral',
        model: 'mistral-ocr-4-1',
        attemptedPages: 2,
        acceptedPages: 1,
        failedOrAmbiguousAttempts: 1,
        providerCostCents: 2,
        providerCostSource: 'provider_usage'
      }]
    }

    const actual = computeActualCosts({ step2: metadata })
    expect(actual.steps).toHaveLength(2)
    expect(actual.steps.find((step) => step.provider === 'openai')).toMatchObject({ model: 'gpt-6.1-sol', cost: 4, inputValue: 3_300 })
    expect(actual.steps.find((step) => step.provider === 'mistral')).toMatchObject({ model: 'mistral-ocr-4-1', cost: 2, inputValue: 2 })
    expect(actual.totalCost).toBe(6)
  })

  test('hosted OCR aggregate pricing rejects invalid PDFs instead of estimating one page', async () => {
      const tempDir = await makeTempDir('autoshow-ocr-price-invalid-')
      const invalidPdf = join(tempDir, 'invalid.pdf')

      await writeFile(invalidPdf, 'not a real PDF\n')

      try {
        await expect(buildAggregatedPriceEstimate('extract', invalidPdf, buildHostedOcrPricingOptions([GROK_OCR_PROVIDER_CASE])))
          .rejects.toThrow(/could not determine PDF page count/i)
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('Gemini OCR estimates and actuals include token cost and page timing', () => {
      expectTokenPricedOcrEstimate({ provider: 'gemini', model: 'gemini-3.8-flash' })

      const actualMetadata: ExtractionMetadata = {
        extractionMethod: 'pdf+gemini-ocr',
        totalPages: 2,
        ocrPages: 2,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'gemini',
        ocrModel: 'gemini-3.8-flash',
        promptTokens: 8000,
        completionTokens: 2000
      }
      const actual = computeActualCosts({ step2: actualMetadata })
      const actualTiming = computeActualProcessingTimes({ step2: actualMetadata })

      expect(actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        promptTokens: 8000,
        completionTokens: 2000
      })
      expect(actual.totalCost).toBeGreaterThan(0)
      expect(actualTiming.steps[0]).toMatchObject({
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        processingTimeMs: 1234
      })
    })

  test('OpenAI OCR estimates include token cost and page timing', () => {
      expectTokenPricedOcrEstimate({ provider: 'openai', model: 'gpt-6-luna' })
    })

  test('Grok OCR estimates and actuals use registered token pricing', () => {
      const extractTargets = [{
        provider: 'grok' as const,
        model: 'grok-4.7',
        pageCount: 2,
        estimateType: 'heuristic' as const
      }]
      const cost = computeEstimatedCosts({
        applyCostMultipliers: false,
        extractTargets,
        hostedOcrTokenProfilePath: missingHostedOcrProfilePath()
      })
      const timing = computeEstimatedProcessingTimes({
        extractTargets,
        concurrencyMode: 'immediate',
        hostedOcrProfilePath: missingHostedOcrProfilePath()
      })

      expect(cost.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'grok',
        model: 'grok-4.7',
        pageCount: 2,
        promptTokens: 8000,
        completionTokens: 2000,
        inputCostPer1MCents: 200,
        outputCostPer1MCents: 600,
        estimateType: 'heuristic'
      })
      expect(cost.totalCost).toBe(2.8)
      expect(timing.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.7',
        processingTimeMs: expectedOcrProcessingMs('grok', 'grok-4.7', 2)
      })

      const actualMetadata: ExtractionMetadata = {
        extractionMethod: 'pdf+grok-ocr',
        totalPages: 1,
        ocrPages: 1,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 5000,
        ocrService: 'grok',
        ocrModel: 'grok-4.7',
        promptTokens: 4000,
        completionTokens: 1000
      }
      const actual = computeActualCosts({ step2: actualMetadata })

      expect(actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'grok',
        model: 'grok-4.7',
        cost: 1.4,
        promptTokens: 4000,
        completionTokens: 1000,
        costSource: 'provider_usage'
      })
      expect(actual.totalCost).toBe(1.4)
    })

  test('hosted token OCR estimates include output tokens when usage is not exact', () => {
      const cost = computeEstimatedCosts({
        applyCostMultipliers: false,
        hostedOcrTokenProfilePath: missingHostedOcrProfilePath(),
        extractTargets: [{
          provider: 'openai',
          model: 'gpt-6-luna',
          pageCount: 2,
          estimateType: 'heuristic'
        }]
      })
      const step = cost.steps[0]

      expect(step).toMatchObject({
        step: 'extract',
        provider: 'openai',
        model: 'gpt-6-luna',
        pageCount: 2,
        promptTokens: 3250,
        completionTokens: 1716,
        estimateType: 'heuristic'
      })
      expect(cost.totalCost).toBe(
        ((step?.promptTokens ?? 0) / 1_000_000) * (step?.inputCostPer1MCents ?? 0)
        + ((step?.completionTokens ?? 0) / 1_000_000) * (step?.outputCostPer1MCents ?? 0)
      )
    })

  test('Mistral OCR additions use page pricing', () => {
      const extractTargets = [
        { provider: 'mistral' as const, model: 'mistral-ocr-4-1', pageCount: 2, estimateType: 'exact' as const }
      ]
      const cost = computeEstimatedCosts({ applyCostMultipliers: false, extractTargets })

      expect(cost.steps).toHaveLength(1)
      for (const step of cost.steps) {
        expect(step).toMatchObject({
          step: 'extract',
          provider: 'mistral',
          pageCount: 2,
          costPer1kPagesCents: 400,
          estimateType: 'exact'
        })
        expect(step.cost).toBe(0.8)
      }
      expect(cost.totalCost).toBe(0.8)
    })
})
