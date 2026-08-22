import { describe, expect, test } from 'bun:test'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { collectEstimatedExtractTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-costs'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildOcrTimingMetadata, missingHostedOcrProfilePath } from './shared'
import { estimateHostedConcurrencyWallTimeMs } from '~/utils/hosted-concurrency-estimator'

describe('price mode contracts', () => {
  test('OCR timing estimates use default page concurrency and explicit serial overrides', () => {
      const pageCount = 21
      const model = 'kimi-k2.6'
      const msPerPage = getExtractEstimation('kimi', model).msPerPage
      const defaultTiming = computeEstimatedProcessingTimes({
        extractTargets: [{ provider: 'kimi', model, pageCount }],
        hostedOcrProfilePath: missingHostedOcrProfilePath()
      })
      const serialTiming = computeEstimatedProcessingTimes({
        extractTargets: [{ provider: 'kimi', model, pageCount }],
        ocrConcurrency: 1,
        hostedOcrProfilePath: missingHostedOcrProfilePath()
      })

      expect(defaultTiming.steps[0]).toMatchObject({
        provider: 'kimi',
        model,
        inputValue: pageCount,
        processingTimeMs: estimateHostedConcurrencyWallTimeMs(Array.from({ length: pageCount }, () => msPerPage), DEFAULT_OCR_CONCURRENCY)
      })
      expect(serialTiming.steps[0]).toMatchObject({
        provider: 'kimi',
        model,
        inputValue: pageCount,
        processingTimeMs: Math.round(pageCount * msPerPage)
      })
      expect(defaultTiming.steps[0]?.throughputValue ?? 0).toBeGreaterThan(serialTiming.steps[0]?.throughputValue ?? 0)
    })

  test('OCR timing estimates adjust rasterized single-page PDF fallback pages', () => {
      const pageCount = 4
      const rasterizedPages = 2
      const model = 'kimi-k2.6'
      const msPerPage = getExtractEstimation('kimi', model).msPerPage
      const metadata = buildOcrTimingMetadata({
        service: 'kimi',
        model,
        pageCount,
        preparation: {
          strategy: 'raster-only',
          directPageAttempts: 2,
          directSuccesses: 0,
          directFailures: 2,
          rasterizedPages,
          directSplittingDisabled: true,
          tools: []
        }
      })
      const extractTargets = collectEstimatedExtractTargets(metadata)
      const normalTiming = computeEstimatedProcessingTimes({
        extractTargets: [{ provider: 'kimi', model, pageCount }],
        ocrConcurrency: 2
      })
      const rasterTiming = computeEstimatedProcessingTimes({
        extractTargets: extractTargets.map((target) => ({
          provider: target.provider,
          model: target.model,
          ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
          ...(typeof target.rasterizedPages === 'number' ? { rasterizedPages: target.rasterizedPages } : {})
        })),
        ocrConcurrency: 2
      })

      expect(extractTargets[0]?.rasterizedPages).toBe(rasterizedPages)
      expect(rasterTiming.steps[0]).toMatchObject({
        provider: 'kimi',
        model,
        inputValue: pageCount,
        processingTimeMs: estimateHostedConcurrencyWallTimeMs([msPerPage, msPerPage, msPerPage * 2, msPerPage * 2], 2),
        timingAdjustment: {
          kind: 'rasterized-single-page-pdf-fallback',
          rasterizedPages,
          directPdfPages: 2,
          rasterizedPageMultiplier: 2,
          pageConcurrency: 2
        }
      })
      expect(rasterTiming.steps[0]?.timingNote).toContain('Rasterized single-page PDF fallback')
      expect(rasterTiming.steps[0]?.processingTimeMs ?? 0).toBeGreaterThan(normalTiming.steps[0]?.processingTimeMs ?? 0)
    })

  test('Gemini 3.5 Flash timing uses single-page PDF fallback calibration from chunk metadata', () => {
      const pageCount = 4
      const model = 'gemini-3.5-flash'
      const fallbackMsPerPage = getExtractEstimation('gemini', model).singlePagePdfFallbackMsPerPage
      const metadata = buildOcrTimingMetadata({
        service: 'gemini',
        model,
        pageCount,
        preparation: {
          strategy: 'direct',
          directPageAttempts: pageCount,
          directSuccesses: pageCount,
          directFailures: 0,
          rasterizedPages: 0,
          directSplittingDisabled: false,
          tools: [{ tool: 'mutool', attempts: pageCount, exitCodes: { '0': pageCount } }]
        }
      })
      const extractTargets = collectEstimatedExtractTargets(metadata)
      const normalTiming = computeEstimatedProcessingTimes({
        extractTargets: [{ provider: 'gemini', model, pageCount }],
        ocrConcurrency: 2
      })
      const fallbackTiming = computeEstimatedProcessingTimes({
        extractTargets: extractTargets.map((target) => ({
          provider: target.provider,
          model: target.model,
          ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
          ...(typeof target.singlePagePdfFallbackPages === 'number' ? { singlePagePdfFallbackPages: target.singlePagePdfFallbackPages } : {})
        })),
        ocrConcurrency: 2
      })

      expect(fallbackMsPerPage).toBe(16700)
      expect(extractTargets[0]?.singlePagePdfFallbackPages).toBe(pageCount)
      expect(fallbackTiming.steps[0]).toMatchObject({
        provider: 'gemini',
        model,
        inputValue: pageCount,
        processingTimeMs: estimateHostedConcurrencyWallTimeMs(Array.from({ length: pageCount }, () => fallbackMsPerPage ?? 0), 2),
        timingAdjustment: {
          kind: 'single-page-pdf-fallback',
          singlePagePdfFallbackPages: pageCount,
          directPdfPages: 0,
          singlePagePdfFallbackMsPerPage: 16700,
          pageConcurrency: 2
        }
      })
      expect(fallbackTiming.steps[0]?.timingNote).toContain('single-page PDF OCR fallback')
      expect(fallbackTiming.steps[0]?.processingTimeMs ?? 0).toBeGreaterThan(normalTiming.steps[0]?.processingTimeMs ?? 0)
    })

  test('OCR timing estimates use hosted provider-pool concurrency for total time', () => {
      const extractTargets = [
        { provider: 'kimi' as const, model: 'kimi-k2.6', pageCount: 4 },
        { provider: 'openai' as const, model: 'gpt-5.4-nano', pageCount: 4 }
      ]
      const serialPool = computeEstimatedProcessingTimes({
        extractTargets,
        ocrConcurrency: 1,
        ocrProviderConcurrency: 1
      })
      const parallelPool = computeEstimatedProcessingTimes({
        extractTargets,
        ocrConcurrency: 1,
        ocrProviderConcurrency: 2
      })
      const serialStepTotal = serialPool.steps.reduce((sum, step) => sum + step.processingTimeMs, 0)
      const parallelStepMax = Math.max(...parallelPool.steps.map((step) => step.processingTimeMs))

      expect(serialPool.totalProcessingTimeMs).toBe(serialStepTotal)
      expect(parallelPool.totalProcessingTimeMs).toBe(parallelStepMax)
      expect(parallelPool.totalProcessingTimeMs).toBeLessThan(serialPool.totalProcessingTimeMs)
    })
})
