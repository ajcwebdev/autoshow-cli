import type { ComputeEstimatedProcessingTimesInput, EstimateConfidence, NormalizedTimingFields, TimingBasisDefinition, TimingScope, TimingStepEntry } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { findHostedOcrThroughputProfile } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-throughput-profiles'

export const OCR_HOSTED_PROVIDERS = new Set([
  'mistral',
  'glm',
  'kimi',
  'openai',
  'grok',
  'anthropic',
  'gemini',
  'deepinfra',
  'replicate'
])
export const OCR_LOCAL_PROVIDERS = new Set(['tesseract'])
export const RASTERIZED_SINGLE_PAGE_PDF_FALLBACK_TIMING_MULTIPLIER = 2

export const roundMs = (value: number): number => Math.max(0, Math.round(value))
export const normalizeConcurrency = (value: number | undefined, fallback = DEFAULT_CLI_CONCURRENCY): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : fallback
export const resolveOcrConcurrencyMode = (input: Pick<ComputeEstimatedProcessingTimesInput, 'ocrConcurrency' | 'ocrConcurrencyMode'>): 'auto' | 'fixed' =>
  input.ocrConcurrencyMode ?? (typeof input.ocrConcurrency === 'number' ? 'fixed' : 'auto')
const roundTimingMetric = (value: number): number => {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}

const defaultTimingMetricForStep = (step: TimingStepEntry['step']): string => {
  switch (step) {
    case 'stt':
    case 'video':
    case 'music':
      return 'durationSeconds'
    case 'extract':
      return 'pages'
    case 'llm':
      return 'tokens'
    case 'tts':
      return 'characters'
    case 'image':
      return 'images'
  }
}

const resolveTimingBasis = (
  step: TimingStepEntry['step'],
  inputMetric: string | undefined,
  inputValue: number
): TimingBasisDefinition | undefined => {
  const metric = inputMetric ?? defaultTimingMetricForStep(step)
  switch (metric) {
    case 'durationMs': {
      const seconds = inputValue / 1000
      return {
        rateBasis: 'durationSecond',
        units: seconds,
        throughputInputValue: seconds,
        throughputUnit: 'x',
        throughputScaleMs: 1000,
      }
    }
    case 'durationSeconds':
      return {
        rateBasis: 'durationSecond',
        units: inputValue,
        throughputInputValue: inputValue,
        throughputUnit: 'x',
        throughputScaleMs: 1000,
      }
    case 'pages':
      return {
        rateBasis: 'page',
        units: inputValue,
        throughputInputValue: inputValue,
        throughputUnit: 'pagesPerMinute',
        throughputScaleMs: 60_000,
      }
    case 'sections':
      return {
        rateBasis: 'section',
        units: inputValue,
        throughputInputValue: inputValue,
        throughputUnit: 'sectionsPerMinute',
        throughputScaleMs: 60_000,
      }
    case 'tokens':
      return {
        rateBasis: '1KTokens',
        units: inputValue / 1000,
        throughputInputValue: inputValue,
        throughputUnit: 'tokensPerSecond',
        throughputScaleMs: 1000,
      }
    case 'characters':
    case 'outputCharacters':
      return {
        rateBasis: '1KCharacters',
        units: inputValue / 1000,
        throughputInputValue: inputValue,
        throughputUnit: 'charactersPerSecond',
        throughputScaleMs: 1000,
      }
    case 'images':
      return {
        rateBasis: 'image',
        units: inputValue,
        throughputInputValue: inputValue,
        throughputUnit: 'imagesPerMinute',
        throughputScaleMs: 60_000,
      }
    default:
      return undefined
  }
}

const computeNormalizedTimingFields = (
  step: TimingStepEntry['step'],
  inputMetric: string | undefined,
  inputValue: number | undefined,
  processingTimeMs: number
): NormalizedTimingFields | undefined => {
  if (
    typeof inputValue !== 'number'
    || !Number.isFinite(inputValue)
    || inputValue <= 0
    || !Number.isFinite(processingTimeMs)
    || processingTimeMs <= 0
  ) {
    return undefined
  }

  const basis = resolveTimingBasis(step, inputMetric, inputValue)
  if (!basis || basis.units <= 0) {
    return undefined
  }

  return {
    rateBasis: basis.rateBasis,
    msPerUnit: roundTimingMetric(processingTimeMs / basis.units),
    throughputValue: roundTimingMetric(basis.throughputInputValue / (processingTimeMs / basis.throughputScaleMs)),
    throughputUnit: basis.throughputUnit,
  }
}

export const withNormalizedTiming = (
  entry: Omit<TimingStepEntry, 'timingScope'>,
  timingScope: TimingScope
): TimingStepEntry => {
  const normalized = computeNormalizedTimingFields(
    entry.step,
    entry.inputMetric,
    entry.inputValue,
    entry.processingTimeMs
  )
  return {
    ...entry,
    ...(normalized ?? {}),
    timingScope,
  }
}

export const isHostedOcrTimingProvider = (provider: string): boolean => OCR_HOSTED_PROVIDERS.has(provider)

export const isLocalOcrTimingProvider = (provider: string): boolean => OCR_LOCAL_PROVIDERS.has(provider)

export const computePoolWallTimeMs = (durations: number[], concurrency: number): number => {
  const normalizedConcurrency = Math.max(1, Math.floor(concurrency))
  const workers = Array.from({ length: Math.min(normalizedConcurrency, durations.length) }, () => 0)
  const sortedDurations = [...durations].sort((left, right) => right - left)

  for (const duration of sortedDurations) {
    let workerIndex = 0
    for (let index = 1; index < workers.length; index++) {
      if ((workers[index] ?? 0) < (workers[workerIndex] ?? 0)) {
        workerIndex = index
      }
    }
    workers[workerIndex] = (workers[workerIndex] ?? 0) + duration
  }

  return workers.reduce((max, duration) => Math.max(max, duration), 0)
}

export const resolveSharedProviderLaneScale = (
  currentLaneTargetCount: number,
  profiledLaneTargetCount: number | undefined
): number => {
  const current = Math.max(1, Math.floor(currentLaneTargetCount))
  if (typeof profiledLaneTargetCount === 'number' && Number.isFinite(profiledLaneTargetCount) && profiledLaneTargetCount > 0) {
    return current / Math.max(1, Math.floor(profiledLaneTargetCount))
  }
  return current > 1 ? current : 1
}

export const applySharedProviderLaneScale = (
  processingTimeMs: number,
  currentLaneTargetCount: number,
  profiledLaneTargetCount: number | undefined
): number => roundMs(processingTimeMs * resolveSharedProviderLaneScale(currentLaneTargetCount, profiledLaneTargetCount))

export const resolveHostedOcrTiming = (
  target: { provider: string, model: string, ocrProviderMode?: 'fanout' | 'pool' },
  pageCount: number,
  registryProcessingTimeMs: number,
  mode: 'auto' | 'fixed',
  profilePath: string | undefined,
  laneTargetCount: number
): {
  processingTimeMs: number
  estimateConfidence: EstimateConfidence
  profileSampleCount?: number | undefined
  profileThroughputPagesPerMinute?: number | undefined
  profileRaisedMaxCap?: number | undefined
  profileCapSource?: string | undefined
  profileSourceConfidence?: string | undefined
  profileDisqualificationReason?: string | undefined
  profileLaneTargetCount?: number | undefined
} => {
  if (!isHostedOcrTimingProvider(target.provider) || target.ocrProviderMode === 'pool') {
    return {
      processingTimeMs: registryProcessingTimeMs,
      estimateConfidence: 'registry'
    }
  }

  const profileEstimate = findHostedOcrThroughputProfile({
    provider: target.provider,
    model: target.model,
    pageCount,
    ocrConcurrencyMode: mode,
    laneTargetCount,
    profilePath
  })
  if (!profileEstimate || profileEstimate.profile.throughputPagesPerMinute <= 0) {
    return {
      processingTimeMs: registryProcessingTimeMs,
      estimateConfidence: 'registry'
    }
  }

  const profileProcessingTimeMs = roundMs((pageCount / profileEstimate.profile.throughputPagesPerMinute) * 60_000)
  if (profileEstimate.confidence === 'healthy') {
    return {
      processingTimeMs: profileProcessingTimeMs,
      estimateConfidence: 'profile',
      profileSampleCount: profileEstimate.profile.sampleCount,
      profileThroughputPagesPerMinute: profileEstimate.profile.throughputPagesPerMinute,
      ...(typeof profileEstimate.profile.laneTargetCount === 'number' ? { profileLaneTargetCount: profileEstimate.profile.laneTargetCount } : {}),
      ...(typeof profileEstimate.profile.raisedMaxCap === 'number' ? { profileRaisedMaxCap: profileEstimate.profile.raisedMaxCap } : {}),
      ...(typeof profileEstimate.profile.capSource === 'string' ? { profileCapSource: profileEstimate.profile.capSource } : {}),
      ...(typeof profileEstimate.profile.sourceConfidence === 'string' ? { profileSourceConfidence: profileEstimate.profile.sourceConfidence } : {}),
      ...(typeof profileEstimate.profile.disqualificationReason === 'string' ? { profileDisqualificationReason: profileEstimate.profile.disqualificationReason } : {})
    }
  }

  const sampleWeight = Math.max(1, Math.min(2, profileEstimate.profile.sampleCount))
  const blended = roundMs(((profileProcessingTimeMs * sampleWeight) + (registryProcessingTimeMs * 2)) / (sampleWeight + 2))
  return {
    processingTimeMs: blended,
    estimateConfidence: 'blended',
    profileSampleCount: profileEstimate.profile.sampleCount,
    profileThroughputPagesPerMinute: profileEstimate.profile.throughputPagesPerMinute,
    ...(typeof profileEstimate.profile.laneTargetCount === 'number' ? { profileLaneTargetCount: profileEstimate.profile.laneTargetCount } : {}),
    ...(typeof profileEstimate.profile.raisedMaxCap === 'number' ? { profileRaisedMaxCap: profileEstimate.profile.raisedMaxCap } : {}),
    ...(typeof profileEstimate.profile.capSource === 'string' ? { profileCapSource: profileEstimate.profile.capSource } : {}),
    ...(typeof profileEstimate.profile.sourceConfidence === 'string' ? { profileSourceConfidence: profileEstimate.profile.sourceConfidence } : {}),
    ...(typeof profileEstimate.profile.disqualificationReason === 'string' ? { profileDisqualificationReason: profileEstimate.profile.disqualificationReason } : {})
  }
}

export const mergeEstimateConfidence = (
  current: EstimateConfidence,
  next: EstimateConfidence
): EstimateConfidence => {
  if (current === 'profile' || next === 'profile') return 'profile'
  if (current === 'blended' || next === 'blended') return 'blended'
  return 'registry'
}

export const normalizeRasterizedPageCount = (
  targetRasterizedPages: number | undefined,
  pageCount: number
): number => {
  if (typeof targetRasterizedPages !== 'number' || !Number.isFinite(targetRasterizedPages)) {
    return 0
  }
  return Math.min(pageCount, Math.max(0, Math.floor(targetRasterizedPages)))
}

export const normalizeSinglePagePdfFallbackPageCount = (
  targetSinglePagePdfFallbackPages: number | undefined,
  pageCount: number
): number => {
  if (typeof targetSinglePagePdfFallbackPages !== 'number' || !Number.isFinite(targetSinglePagePdfFallbackPages)) {
    return 0
  }
  return Math.min(pageCount, Math.max(0, Math.floor(targetSinglePagePdfFallbackPages)))
}
