import type { ComputeEstimatedProcessingTimesInput, EstimateConfidence, ExtractStepBuildParams, TimingStepEntry } from '~/types'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveHostedOcrEstimateCap } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { estimateHostedConcurrencyWallTimeMs } from '~/utils/hosted-concurrency-estimator'
import { resolveEstimatedExtractProcessingMs } from '../provider-family-resolvers'
import {
  RASTERIZED_SINGLE_PAGE_PDF_FALLBACK_TIMING_MULTIPLIER,
  applySharedProviderLaneScale,
  computePoolWallTimeMs,
  isHostedOcrTimingProvider,
  isLocalOcrTimingProvider,
  normalizeConcurrency,
  normalizeRasterizedPageCount,
  normalizeSinglePagePdfFallbackPageCount,
  resolveHostedOcrTiming,
  resolveSharedProviderLaneScale,
  roundMs,
  withNormalizedTiming,
} from './timing-shared'

type ExtractTarget = NonNullable<ComputeEstimatedProcessingTimesInput['extractTargets']>[number]

const profileTimingAdjustmentFields = (
  timed: ReturnType<typeof resolveHostedOcrTiming>
): Record<string, number | string> => ({
  ...(typeof timed.profileLaneTargetCount === 'number' ? { profileLaneTargetCount: timed.profileLaneTargetCount } : {}),
  ...(typeof timed.profileSampleCount === 'number' ? { profileSampleCount: timed.profileSampleCount } : {}),
  ...(typeof timed.profileThroughputPagesPerMinute === 'number' ? { profileThroughputPagesPerMinute: timed.profileThroughputPagesPerMinute } : {}),
  ...(typeof timed.profileRaisedMaxCap === 'number' ? { profileRaisedMaxCap: timed.profileRaisedMaxCap } : {}),
  ...(typeof timed.profileCapSource === 'string' ? { profileCapSource: timed.profileCapSource } : {}),
  ...(typeof timed.profileSourceConfidence === 'string' ? { profileSourceConfidence: timed.profileSourceConfidence } : {}),
  ...(typeof timed.profileDisqualificationReason === 'string' ? { profileDisqualificationReason: timed.profileDisqualificationReason } : {})
})

const buildFallbackExtractStep = (
  params: ExtractStepBuildParams,
  fallback: { pages: number, msPerPage: number, timingNote: string, timingAdjustment: Record<string, unknown> }
): { entry: TimingStepEntry, confidence: EstimateConfidence } => {
  const { target, resolvedPageCount, estimation, pageConcurrency, ocrConcurrencyMode, hostedOcrProfilePath, sharedProviderLaneTargetCount } = params
  const directPdfPages = Math.max(0, resolvedPageCount - fallback.pages)
  const pageDurations = [
    ...Array.from({ length: directPdfPages }, () => estimation.msPerPage),
    ...Array.from({ length: fallback.pages }, () => fallback.msPerPage)
  ]
  const registryProcessingTimeMs = roundMs(params.isHostedOcr
    ? estimateHostedConcurrencyWallTimeMs(pageDurations, pageConcurrency, params.concurrencyMode)
    : computePoolWallTimeMs(pageDurations, pageConcurrency))
  const timed = resolveHostedOcrTiming(target, resolvedPageCount, registryProcessingTimeMs, ocrConcurrencyMode, hostedOcrProfilePath, sharedProviderLaneTargetCount)
  const sharedProviderLaneScale = resolveSharedProviderLaneScale(sharedProviderLaneTargetCount, timed.profileLaneTargetCount)
  const processingTimeMs = applySharedProviderLaneScale(timed.processingTimeMs, sharedProviderLaneTargetCount, timed.profileLaneTargetCount)
  const entry = withNormalizedTiming({
    step: 'extract', provider: target.provider, model: target.model, processingTimeMs,
    inputMetric: 'pages', inputValue: resolvedPageCount, timingNote: fallback.timingNote,
    timingAdjustment: {
      ...fallback.timingAdjustment,
      directPdfPages,
      pageConcurrency,
      ocrConcurrencyMode,
      estimateConfidence: timed.estimateConfidence,
      ...(sharedProviderLaneTargetCount > 1 ? { sharedProviderLaneTargetCount } : {}),
      ...(sharedProviderLaneScale !== 1 ? { sharedProviderLaneScale } : {}),
      ...profileTimingAdjustmentFields(timed)
    }
  }, 'estimated')
  return { entry, confidence: timed.estimateConfidence }
}

const buildSelectedExtractStep = (
  params: ExtractStepBuildParams
): { entry: TimingStepEntry, confidence: EstimateConfidence } => {
  if (params.singlePagePdfFallbackPages > 0 && typeof params.estimation.singlePagePdfFallbackMsPerPage === 'number') {
    return buildFallbackExtractStep(params, {
      pages: params.singlePagePdfFallbackPages,
      msPerPage: params.estimation.singlePagePdfFallbackMsPerPage,
      timingNote: 'Resumable single-page PDF OCR fallback uses observed slower per-page timing.',
      timingAdjustment: {
        kind: 'single-page-pdf-fallback',
        singlePagePdfFallbackPages: params.singlePagePdfFallbackPages,
        singlePagePdfFallbackMsPerPage: params.estimation.singlePagePdfFallbackMsPerPage,
        ...(params.rasterizedPages > 0 ? { rasterizedPages: params.rasterizedPages } : {})
      }
    })
  }
  if (params.rasterizedPages > 0) {
    return buildFallbackExtractStep(params, {
      pages: params.rasterizedPages,
      msPerPage: params.estimation.msPerPage * RASTERIZED_SINGLE_PAGE_PDF_FALLBACK_TIMING_MULTIPLIER,
      timingNote: 'Rasterized single-page PDF fallback uses slower per-page timing for rasterized pages.',
      timingAdjustment: {
        kind: 'rasterized-single-page-pdf-fallback',
        rasterizedPages: params.rasterizedPages,
        rasterizedPageMultiplier: RASTERIZED_SINGLE_PAGE_PDF_FALLBACK_TIMING_MULTIPLIER
      }
    })
  }
  const timed = resolveHostedOcrTiming(params.target, params.resolvedPageCount, params.resolvedProcessingTimeMs, params.ocrConcurrencyMode, params.hostedOcrProfilePath, params.sharedProviderLaneTargetCount)
  const sharedProviderLaneScale = resolveSharedProviderLaneScale(params.sharedProviderLaneTargetCount, timed.profileLaneTargetCount)
  const processingTimeMs = applySharedProviderLaneScale(timed.processingTimeMs, params.sharedProviderLaneTargetCount, timed.profileLaneTargetCount)
  const entry = withNormalizedTiming({
    step: 'extract', provider: params.target.provider, model: params.target.model, processingTimeMs,
    inputMetric: 'pages', inputValue: params.resolvedPageCount,
    ...(params.isPooledOcr
      ? { timingAdjustment: {
          kind: params.isHostedOcr ? 'hosted-ocr-page-concurrency' : 'local-ocr-page-concurrency',
          pageConcurrency: params.pageConcurrency,
          ...(params.isHostedOcr ? { ocrConcurrencyMode: params.ocrConcurrencyMode, estimateConfidence: timed.estimateConfidence } : {}),
          ...(params.sharedProviderLaneTargetCount > 1 ? { sharedProviderLaneTargetCount: params.sharedProviderLaneTargetCount } : {}),
          ...(sharedProviderLaneScale !== 1 ? { sharedProviderLaneScale } : {}),
          ...profileTimingAdjustmentFields(timed)
        } }
      : {})
  }, 'estimated')
  return { entry, confidence: timed.estimateConfidence }
}

export const buildExtractTimingStep = (
  target: ExtractTarget,
  input: ComputeEstimatedProcessingTimesInput,
  ocrConcurrencyMode: ReturnType<typeof import('./timing-shared').resolveOcrConcurrencyMode>,
  sharedProviderLaneTargetCount: number
): { entry: TimingStepEntry, confidence: EstimateConfidence } => {
  const isHostedOcr = isHostedOcrTimingProvider(target.provider)
  const isLocalOcr = isLocalOcrTimingProvider(target.provider)
  const isPooledOcr = isHostedOcr || isLocalOcr
  const pageConcurrency = isHostedOcr
    ? resolveHostedOcrEstimateCap(target.pageCount ?? input.extractPageCount ?? 1, ocrConcurrencyMode, input.ocrConcurrency)
    : isLocalOcr
      ? normalizeConcurrency(input.ocrConcurrency, DEFAULT_OCR_CONCURRENCY)
      : 1
  const resolved = resolveEstimatedExtractProcessingMs(target, input.extractPageCount, { pageConcurrency })
  const estimation = getExtractEstimation(target.provider, target.model)
  const params: ExtractStepBuildParams = {
    target,
    resolvedPageCount: resolved.pageCount,
    resolvedProcessingTimeMs: isHostedOcr
      ? estimateHostedConcurrencyWallTimeMs(Array.from({ length: resolved.pageCount }, () => estimation.msPerPage), pageConcurrency, input.concurrencyMode ?? 'ramp')
      : resolved.processingTimeMs,
    estimation,
    pageConcurrency,
    ocrConcurrencyMode,
    hostedOcrProfilePath: input.hostedOcrProfilePath,
    sharedProviderLaneTargetCount,
    rasterizedPages: isPooledOcr ? normalizeRasterizedPageCount(target.rasterizedPages, resolved.pageCount) : 0,
    singlePagePdfFallbackPages: isPooledOcr ? normalizeSinglePagePdfFallbackPageCount(target.singlePagePdfFallbackPages, resolved.pageCount) : 0,
    isPooledOcr,
    isHostedOcr,
    concurrencyMode: input.concurrencyMode ?? 'ramp'
  }
  return buildSelectedExtractStep(params)
}
