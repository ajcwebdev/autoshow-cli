import type { ComputeEstimatedProcessingTimesInput, EstimateConfidence, ExtractStepBuildParams, TimingStepEntry, TimingStepsResult } from '~/types'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveHostedOcrEstimateCap } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { resolveEstimatedExtractProcessingMs } from '../provider-family-resolvers'
import {
  RASTERIZED_SINGLE_PAGE_PDF_FALLBACK_TIMING_MULTIPLIER,
  applySharedProviderLaneScale,
  computePoolWallTimeMs,
  isHostedOcrTimingProvider,
  isLocalOcrTimingProvider,
  mergeEstimateConfidence,
  normalizeConcurrency,
  normalizeRasterizedPageCount,
  normalizeSinglePagePdfFallbackPageCount,
  resolveHostedOcrTiming,
  resolveOcrConcurrencyMode,
  resolveSharedProviderLaneScale,
  roundMs,
  withNormalizedTiming,
} from './timing-shared'
import { estimateHostedConcurrencyWallTimeMs } from '~/utils/hosted-concurrency-estimator'

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
  fallback: {
    pages: number
    msPerPage: number
    timingNote: string
    timingAdjustment: Record<string, unknown>
  }
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
    step: 'extract',
    provider: target.provider,
    model: target.model,
    processingTimeMs,
    inputMetric: 'pages',
    inputValue: resolvedPageCount,
    timingNote: fallback.timingNote,
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

const buildSinglePagePdfFallbackStep = (
  params: ExtractStepBuildParams & { singlePagePdfFallbackMsPerPage: number }
): { entry: TimingStepEntry, confidence: EstimateConfidence } => buildFallbackExtractStep(params, {
  pages: params.singlePagePdfFallbackPages,
  msPerPage: params.singlePagePdfFallbackMsPerPage,
  timingNote: 'Resumable single-page PDF OCR fallback uses observed slower per-page timing.',
  timingAdjustment: {
    kind: 'single-page-pdf-fallback',
    singlePagePdfFallbackPages: params.singlePagePdfFallbackPages,
    singlePagePdfFallbackMsPerPage: params.estimation.singlePagePdfFallbackMsPerPage,
    ...(params.rasterizedPages > 0 ? { rasterizedPages: params.rasterizedPages } : {})
  }
})

const buildRasterizedFallbackStep = (
  params: ExtractStepBuildParams
): { entry: TimingStepEntry, confidence: EstimateConfidence } => buildFallbackExtractStep(params, {
  pages: params.rasterizedPages,
  msPerPage: params.estimation.msPerPage * RASTERIZED_SINGLE_PAGE_PDF_FALLBACK_TIMING_MULTIPLIER,
  timingNote: 'Rasterized single-page PDF fallback uses slower per-page timing for rasterized pages.',
  timingAdjustment: {
    kind: 'rasterized-single-page-pdf-fallback',
    rasterizedPages: params.rasterizedPages,
    rasterizedPageMultiplier: RASTERIZED_SINGLE_PAGE_PDF_FALLBACK_TIMING_MULTIPLIER
  }
})

const buildNormalExtractStep = (
  params: ExtractStepBuildParams
): { entry: TimingStepEntry, confidence: EstimateConfidence } => {
  const { target, resolvedPageCount, resolvedProcessingTimeMs, pageConcurrency, ocrConcurrencyMode, hostedOcrProfilePath, sharedProviderLaneTargetCount, isPooledOcr, isHostedOcr } = params
  const timed = resolveHostedOcrTiming(target, resolvedPageCount, resolvedProcessingTimeMs, ocrConcurrencyMode, hostedOcrProfilePath, sharedProviderLaneTargetCount)
  const sharedProviderLaneScale = resolveSharedProviderLaneScale(sharedProviderLaneTargetCount, timed.profileLaneTargetCount)
  const processingTimeMs = applySharedProviderLaneScale(timed.processingTimeMs, sharedProviderLaneTargetCount, timed.profileLaneTargetCount)
  const entry = withNormalizedTiming({
    step: 'extract',
    provider: target.provider,
    model: target.model,
    processingTimeMs,
    inputMetric: 'pages',
    inputValue: resolvedPageCount,
    ...(isPooledOcr
      ? {
          timingAdjustment: {
            kind: isHostedOcr ? 'hosted-ocr-page-concurrency' : 'local-ocr-page-concurrency',
            pageConcurrency,
            ...(isHostedOcr ? { ocrConcurrencyMode, estimateConfidence: timed.estimateConfidence } : {}),
            ...(sharedProviderLaneTargetCount > 1 ? { sharedProviderLaneTargetCount } : {}),
            ...(sharedProviderLaneScale !== 1 ? { sharedProviderLaneScale } : {}),
            ...profileTimingAdjustmentFields(timed)
          }
        }
      : {})
  }, 'estimated')
  return { entry, confidence: timed.estimateConfidence }
}

export const buildExtractTimingSteps = (input: ComputeEstimatedProcessingTimesInput): TimingStepsResult => {
  const steps: TimingStepEntry[] = []
  let estimateConfidence: EstimateConfidence = 'registry'
  const ocrConcurrencyMode = resolveOcrConcurrencyMode(input)

  const extractTargets: NonNullable<ComputeEstimatedProcessingTimesInput['extractTargets']> = input.extractTargets && input.extractTargets.length > 0
    ? input.extractTargets
    : [
        ...(input.mistralOcrModels?.[0] && typeof input.extractPageCount === 'number'
          ? [{ provider: 'mistral' as const, model: input.mistralOcrModels[0], pageCount: input.extractPageCount }]
          : []),
        ...(input.glmOcrModels?.[0] && typeof input.extractPageCount === 'number'
          ? [{ provider: 'glm' as const, model: input.glmOcrModels[0], pageCount: input.extractPageCount }]
          : []),
        ...(input.kimiOcrModels?.[0] && typeof input.extractPageCount === 'number'
          ? [{ provider: 'kimi' as const, model: input.kimiOcrModels[0], pageCount: input.extractPageCount }]
          : []),
        ...(input.openaiOcrModels?.[0] && typeof input.extractPageCount === 'number'
          ? [{ provider: 'openai' as const, model: input.openaiOcrModels[0], pageCount: input.extractPageCount }]
          : []),
        ...(input.grokOcrModels?.[0] && typeof input.extractPageCount === 'number'
          ? [{ provider: 'grok' as const, model: input.grokOcrModels[0], pageCount: input.extractPageCount }]
          : []),
        ...(input.anthropicOcrModels?.[0] && typeof input.extractPageCount === 'number'
          ? [{ provider: 'anthropic' as const, model: input.anthropicOcrModels[0], pageCount: input.extractPageCount }]
          : []),
        ...(input.geminiOcrModels?.[0] && typeof input.extractPageCount === 'number'
          ? [{ provider: 'gemini' as const, model: input.geminiOcrModels[0], pageCount: input.extractPageCount }]
          : []),
        ...(input.deepinfraOcrModels?.[0] && typeof input.extractPageCount === 'number'
          ? [{ provider: 'deepinfra' as const, model: input.deepinfraOcrModels[0], pageCount: input.extractPageCount }]
          : [])
      ]
  const hostedOcrTargetCountsByProvider = new Map<string, number>()
  for (const target of extractTargets) {
    if (isHostedOcrTimingProvider(target.provider)) {
      hostedOcrTargetCountsByProvider.set(target.provider, (hostedOcrTargetCountsByProvider.get(target.provider) ?? 0) + 1)
    }
  }

  for (const target of extractTargets) {
    const isHostedOcr = isHostedOcrTimingProvider(target.provider)
    const isLocalOcr = isLocalOcrTimingProvider(target.provider)
    const isPooledOcr = isHostedOcr || isLocalOcr
    const sharedProviderLaneTargetCount = isHostedOcr
      ? hostedOcrTargetCountsByProvider.get(target.provider) ?? 1
      : 1
    const pageConcurrency = isHostedOcr
      ? resolveHostedOcrEstimateCap(target.pageCount ?? input.extractPageCount ?? 1, ocrConcurrencyMode, input.ocrConcurrency)
      : isLocalOcr
        ? normalizeConcurrency(input.ocrConcurrency, DEFAULT_OCR_CONCURRENCY)
        : 1
    const resolved = resolveEstimatedExtractProcessingMs(target, input.extractPageCount, {
      pageConcurrency
    })
    const rasterizedPages = isPooledOcr
      ? normalizeRasterizedPageCount(target.rasterizedPages, resolved.pageCount)
      : 0
    const singlePagePdfFallbackPages = isPooledOcr
      ? normalizeSinglePagePdfFallbackPageCount(target.singlePagePdfFallbackPages, resolved.pageCount)
      : 0
    const estimation = getExtractEstimation(target.provider, target.model)
    const baseParams: ExtractStepBuildParams = {
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
      rasterizedPages,
      singlePagePdfFallbackPages,
      isPooledOcr,
      isHostedOcr,
      concurrencyMode: input.concurrencyMode ?? 'ramp',
    }
    if (singlePagePdfFallbackPages > 0 && typeof estimation.singlePagePdfFallbackMsPerPage === 'number') {
      const { entry, confidence } = buildSinglePagePdfFallbackStep({
        ...baseParams,
        singlePagePdfFallbackMsPerPage: estimation.singlePagePdfFallbackMsPerPage
      })
      estimateConfidence = mergeEstimateConfidence(estimateConfidence, confidence)
      steps.push(entry)
      continue
    }
    if (rasterizedPages > 0) {
      const { entry, confidence } = buildRasterizedFallbackStep(baseParams)
      estimateConfidence = mergeEstimateConfidence(estimateConfidence, confidence)
      steps.push(entry)
      continue
    }
    const { entry, confidence } = buildNormalExtractStep(baseParams)
    estimateConfidence = mergeEstimateConfidence(estimateConfidence, confidence)
    steps.push(entry)
  }

  return { steps, confidence: estimateConfidence }
}
