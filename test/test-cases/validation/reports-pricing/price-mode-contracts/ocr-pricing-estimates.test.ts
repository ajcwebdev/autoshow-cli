import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { estimateFirecrawlScrapeCost } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/ocr-estimates'
import { buildArticleEstimates } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/build-article-estimates'
import { formatEstimatedCostWithExactCents } from '~/utils/app-logger/formatters'
import { allocatePooledOcrPages, buildExtractEstimates } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates'
import { getExtractEstimation, getExtractPricing, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import type { ExtractionMetadata } from '~/types'
import {
  HOSTED_OCR_PROVIDER_CASES,
  KIMI_OCR_PROVIDER_CASE,
  MULTI_PAGE_PDF,
  buildHostedOcrPricingOptions,
  expectedOcrProcessingMs,
  missingHostedOcrProfilePath
} from './shared'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

/**
 * Token-priced OCR providers all report the same estimate and timing shape for a
 * two-page heuristic run; only provider identity varies, so the shared prelude lives
 * here and each suite keeps its own provider-specific follow-up assertions.
 */
const expectTokenPricedOcrEstimate = (target: { provider: 'deepinfra' | 'kimi', model: string }): void => {
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
  test('URL article extract estimates use Firecrawl and glm-reader page rates without fetching', () => {
      const firecrawl = estimateFirecrawlScrapeCost()
      expect(firecrawl).toMatchObject({
        provider: 'firecrawl',
        model: 'firecrawl',
        pageCount: 1,
        totalCost: 0.083,
        estimateType: 'exact'
      })
      expect(firecrawl.note).toContain('Firecrawl')

      const glmCents = (1 / 1000) * (getExtractPricing('glm-reader', 'glm-reader').costPer1kPagesCents ?? 0)
      expect(formatEstimatedCostWithExactCents(glmCents)).toBe('1.00¢ (1.000¢)')

      const estimates = buildArticleEstimates(
        { route: 'article', sourceKind: 'article', providers: [
          { service: 'firecrawl', model: 'firecrawl', origin: 'explicit' },
          { service: 'glm-reader', model: 'glm-reader', origin: 'explicit' }
        ] },
        { urlBackend: 'glm-reader' },
        true
      )
      expect(estimates.estimates.map((step) => ({
        provider: step.provider,
        model: step.model,
        totalCost: step.totalCost
      }))).toEqual([
        { provider: 'firecrawl', model: 'firecrawl', totalCost: 0.083 },
        { provider: 'glm-reader', model: 'glm-reader', totalCost: 1 }
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
      { service: 'openai' as const, model: 'gpt-5.6-sol' },
      { service: 'openai' as const, model: 'gpt-5.4-mini' },
      { service: 'gemini' as const, model: 'gemini-3.6-flash' }
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
        model: 'gpt-5.6-sol',
        attemptedPages: 3,
        acceptedPages: 2,
        failedOrAmbiguousAttempts: 1,
        promptTokens: 3_000,
        completionTokens: 300,
        providerCostCents: 4,
        providerCostSource: 'provider_usage'
      }, {
        provider: 'mistral',
        model: 'mistral-ocr-4-0',
        attemptedPages: 2,
        acceptedPages: 1,
        failedOrAmbiguousAttempts: 1,
        providerCostCents: 2,
        providerCostSource: 'provider_usage'
      }]
    }

    const actual = computeActualCosts({ step2: metadata })
    expect(actual.steps).toHaveLength(2)
    expect(actual.steps.find((step) => step.provider === 'openai')).toMatchObject({ model: 'gpt-5.6-sol', cost: 4, inputValue: 3_300 })
    expect(actual.steps.find((step) => step.provider === 'mistral')).toMatchObject({ model: 'mistral-ocr-4-0', cost: 2, inputValue: 2 })
    expect(actual.totalCost).toBe(6)
  })

  test('hosted OCR aggregate pricing rejects invalid PDFs instead of estimating one page', async () => {
      const tempDir = await makeTempDir('autoshow-ocr-price-invalid-')
      const invalidPdf = join(tempDir, 'invalid.pdf')

      await writeFile(invalidPdf, 'not a real PDF\n')

      try {
        await expect(buildAggregatedPriceEstimate('extract', invalidPdf, buildHostedOcrPricingOptions([KIMI_OCR_PROVIDER_CASE])))
          .rejects.toThrow(/could not determine PDF page count/i)
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('DeepInfra OCR estimates include token cost and page timing', () => {
      expectTokenPricedOcrEstimate({ provider: 'deepinfra', model: 'Qwen/Qwen3-VL-30B-A3B-Instruct' })

      const actualMetadata: ExtractionMetadata = {
        extractionMethod: 'pdf+deepinfra-ocr',
        totalPages: 2,
        ocrPages: 2,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10_000,
        ocrService: 'deepinfra',
        ocrModel: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        promptTokens: 8000,
        completionTokens: 2000
      }
      const actual = computeActualCosts({ step2: actualMetadata })
      const actualTiming = computeActualProcessingTimes({ step2: actualMetadata })

      expect(actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'deepinfra',
        model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        promptTokens: 8000,
        completionTokens: 2000
      })
      expect(actual.totalCost).toBeGreaterThan(0)
      expect(actualTiming.steps[0]).toMatchObject({
        provider: 'deepinfra',
        model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        processingTimeMs: 1234
      })
    })

  test('Kimi OCR estimates include token cost and page timing', () => {
      expectTokenPricedOcrEstimate({ provider: 'kimi', model: 'kimi-k2.6' })
    })

  test('Grok OCR estimates and actuals use provisional token pricing', () => {
      const extractTargets = [{
        provider: 'grok' as const,
        model: 'grok-4.3',
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
        model: 'grok-4.3',
        pageCount: 2,
        promptTokens: 8000,
        completionTokens: 2000,
        inputCostPer1MCents: 125,
        outputCostPer1MCents: 250,
        estimateType: 'heuristic'
      })
      expect(cost.totalCost).toBe(1.5)
      expect(timing.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.3',
        processingTimeMs: expectedOcrProcessingMs('grok', 'grok-4.3', 2)
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
        ocrModel: 'grok-4.3',
        promptTokens: 4000,
        completionTokens: 1000
      }
      const actual = computeActualCosts({ step2: actualMetadata })

      expect(actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'grok',
        model: 'grok-4.3',
        cost: 0.75,
        promptTokens: 4000,
        completionTokens: 1000,
        costSource: 'provider_usage'
      })
      expect(actual.totalCost).toBe(0.75)

      const grok45Targets = [{
        provider: 'grok' as const,
        model: 'grok-4.5',
        pageCount: 1,
        estimateType: 'heuristic' as const
      }]
      const grok45Cost = computeEstimatedCosts({
        applyCostMultipliers: false,
        extractTargets: grok45Targets,
        hostedOcrTokenProfilePath: missingHostedOcrProfilePath()
      })
      const grok45Timing = computeEstimatedProcessingTimes({
        extractTargets: grok45Targets,
        hostedOcrProfilePath: missingHostedOcrProfilePath()
      })
      const grok45Actual = computeActualCosts({
        step2: {
          ...actualMetadata,
          ocrModel: 'grok-4.5'
        }
      })

      expect(grok45Cost.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'grok',
        model: 'grok-4.5',
        pageCount: 1,
        promptTokens: 4000,
        completionTokens: 1000,
        inputCostPer1MCents: 200,
        outputCostPer1MCents: 600,
        estimateType: 'heuristic'
      })
      expect(grok45Cost.totalCost).toBe(1.4)
      expect(grok45Timing.steps[0]).toMatchObject({
        provider: 'grok',
        model: 'grok-4.5',
        processingTimeMs: expectedOcrProcessingMs('grok', 'grok-4.5', 1)
      })
      expect(grok45Actual.steps[0]).toMatchObject({
        step: 'extract',
        provider: 'grok',
        model: 'grok-4.5',
        cost: 1.4,
        promptTokens: 4000,
        completionTokens: 1000,
        costSource: 'provider_usage'
      })
      expect(grok45Actual.totalCost).toBe(1.4)
    })

  test('hosted token OCR estimates include output tokens when usage is not exact', () => {
      const cost = computeEstimatedCosts({
        applyCostMultipliers: false,
        hostedOcrTokenProfilePath: missingHostedOcrProfilePath(),
        extractTargets: [{
          provider: 'openai',
          model: 'gpt-5.4-nano',
          pageCount: 2,
          estimateType: 'heuristic'
        }]
      })
      const step = cost.steps[0]

      expect(step).toMatchObject({
        step: 'extract',
        provider: 'openai',
        model: 'gpt-5.4-nano',
        pageCount: 2,
        promptTokens: 5972,
        completionTokens: 3688,
        estimateType: 'heuristic'
      })
      expect(cost.totalCost).toBe(
        ((step?.promptTokens ?? 0) / 1_000_000) * (step?.inputCostPer1MCents ?? 0)
        + ((step?.completionTokens ?? 0) / 1_000_000) * (step?.outputCostPer1MCents ?? 0)
      )
    })

  test('Mistral OCR additions use page pricing', () => {
      const extractTargets = [
        { provider: 'mistral' as const, model: 'mistral-ocr-4-0', pageCount: 2, estimateType: 'exact' as const }
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
