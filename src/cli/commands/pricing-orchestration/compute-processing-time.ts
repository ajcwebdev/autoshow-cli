import type { ComputeActualProcessingTimesInput, ComputeEstimatedProcessingTimesInput, EstimateConfidence, StepTimingBreakdown, TimingBreakdown, TimingStepEntry } from '~/types'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'
import { buildExtractTimingSteps } from './compute-processing-time/extract-timing-steps'
import { buildImageTimingSteps } from './compute-processing-time/image-timing-steps'
import { buildLlmTimingSteps } from './compute-processing-time/llm-timing-steps'
import { buildMusicTimingSteps } from './compute-processing-time/music-timing-steps'
import { buildSttTimingSteps } from './compute-processing-time/stt-timing-steps'
import { buildTtsTimingSteps } from './compute-processing-time/tts-timing-steps'
import { buildVideoTimingSteps } from './compute-processing-time/video-timing-steps'
import {
  computePoolWallTimeMs,
  isHostedOcrTimingProvider,
  isLocalOcrTimingProvider,
  mergeEstimateConfidence,
  normalizeConcurrency,
  roundMs,
  withNormalizedTiming,
} from './compute-processing-time/timing-shared'
import { walkRunSteps } from './run-step-walk'

const TIMING_BREAKDOWN_KEYS = [
  'queueWaitMs',
  'transcribeMs',
  'uploadMs',
  'createMs',
  'pollMs',
  'pollSleepMs',
  'transcriptMs',
  'remoteProcessingMs',
  'cleanupMs',
] as const satisfies readonly (keyof TimingBreakdown)[]

const normalizeTimingBreakdown = (
  value: Partial<Record<keyof TimingBreakdown, number | undefined>> | undefined
): TimingBreakdown | undefined => {
  if (!value) return undefined

  const out: TimingBreakdown = {}
  for (const key of TIMING_BREAKDOWN_KEYS) {
    const entry = value[key]
    if (typeof entry === 'number' && Number.isFinite(entry) && entry >= 0) {
      out[key] = roundMs(entry)
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

const computeTotalProcessingTimeMs = (
  steps: TimingStepEntry[],
  input: {
    ocrProviderConcurrency?: number | undefined
    ocrLocalConcurrency?: number | undefined
  }
): number => {
  const hostedOcrSteps = steps.filter((step) => step.step === 'extract' && isHostedOcrTimingProvider(step.provider))
  const localOcrSteps = steps.filter((step) => step.step === 'extract' && isLocalOcrTimingProvider(step.provider))
  const providerPooledExtractSteps = new Set([...hostedOcrSteps, ...localOcrSteps])
  const nonPooledTotal = steps
    .filter((step) => !providerPooledExtractSteps.has(step))
    .reduce((sum, step) => sum + step.processingTimeMs, 0)
  const hostedLaneDurations = new Map<string, number>()
  for (const step of hostedOcrSteps) {
    hostedLaneDurations.set(step.provider, Math.max(hostedLaneDurations.get(step.provider) ?? 0, step.processingTimeMs))
  }

  return nonPooledTotal
    + computePoolWallTimeMs([...hostedLaneDurations.values()], normalizeConcurrency(input.ocrProviderConcurrency, DEFAULT_OCR_CONCURRENCY))
    + computePoolWallTimeMs(localOcrSteps.map((step) => step.processingTimeMs), normalizeConcurrency(input.ocrLocalConcurrency, DEFAULT_OCR_CONCURRENCY))
}

const buildLikelyGatingTargets = (
  steps: TimingStepEntry[]
): NonNullable<StepTimingBreakdown['likelyGatingTargets']> | undefined => {
  const target = steps
    .filter((step) => step.processingTimeMs > 0)
    .sort((left, right) => right.processingTimeMs - left.processingTimeMs)[0]
  return target
    ? [{
        step: target.step,
        provider: target.provider,
        model: target.model,
        processingTimeMs: target.processingTimeMs
      }]
    : undefined
}

export const computeEstimatedProcessingTimes = (
  input: ComputeEstimatedProcessingTimesInput
): StepTimingBreakdown => {
  const steps: TimingStepEntry[] = []
  let estimateConfidence: EstimateConfidence = 'registry'

  const builderResults = [
    buildSttTimingSteps(input),
    buildExtractTimingSteps(input),
    buildLlmTimingSteps(input),
    buildTtsTimingSteps(input),
    buildImageTimingSteps(input),
    buildVideoTimingSteps(input),
    buildMusicTimingSteps(input),
  ]

  for (const result of builderResults) {
    for (const step of result.steps) {
      steps.push(step)
    }
    if (result.confidence) {
      estimateConfidence = mergeEstimateConfidence(estimateConfidence, result.confidence)
    }
  }

  return {
    totalProcessingTimeMs: computeTotalProcessingTimeMs(steps, input),
    steps,
    estimateConfidence,
    ...(buildLikelyGatingTargets(steps) ? { likelyGatingTargets: buildLikelyGatingTargets(steps) } : {})
  }
}

export const computeActualProcessingTimes = (
  input: ComputeActualProcessingTimesInput
): StepTimingBreakdown => {
  const steps: TimingStepEntry[] = []
  walkRunSteps(input, {
    partialStep2Order: 'after-step2',
    visitors: {
      stt: (metadata, model) => {
        const timingBreakdown = normalizeTimingBreakdown(metadata.timings)
        steps.push(withNormalizedTiming({
          step: 'stt',
          provider: metadata.transcriptionService,
          model,
          processingTimeMs: roundMs(metadata.processingTime),
          ...(timingBreakdown ? { timingBreakdown } : {}),
          ...(typeof input.audioDurationSeconds === 'number'
            ? {
                inputMetric: 'durationSeconds' as const,
                inputValue: input.audioDurationSeconds,
              }
            : {
                inputMetric: 'tokens' as const,
                inputValue: metadata.tokenCount,
              }),
        }, 'wall'))
      },
      extract: (metadata) => {
        const { provider, model } = resolveExtractionProviderModel(metadata)
        steps.push(withNormalizedTiming({
          step: 'extract',
          provider,
          model,
          processingTimeMs: roundMs(metadata.processingTime),
          inputMetric: metadata.extractionMethod === 'epub-text' ? 'sections' : 'pages',
          inputValue: metadata.totalPages,
        }, 'wall'))
      },
      partialExtract: (metadata) => {
        const { provider, model } = resolveExtractionProviderModel(metadata)
        steps.push(withNormalizedTiming({
          step: 'extract',
          provider,
          model,
          processingTimeMs: roundMs(metadata.processingTime),
          inputMetric: 'pages',
          inputValue: metadata.completedPages,
          timingNote: 'Partial failed provider; timing covers cached page artifacts through failure.'
        }, 'wall'))
      },
      llm: (metadata) => {
        const tokenCount = metadata.inputTokenCount + metadata.outputTokenCount
        steps.push(withNormalizedTiming({
          step: 'llm',
          provider: metadata.llmService,
          model: metadata.llmModel,
          processingTimeMs: roundMs(metadata.processingTime),
          inputMetric: 'tokens',
          inputValue: tokenCount,
        }, 'wall'))
      },
      tts: (metadata, characterCount) => {
        steps.push(withNormalizedTiming({
          step: 'tts',
          provider: metadata.ttsService,
          model: metadata.ttsModel,
          processingTimeMs: roundMs(metadata.processingTime),
          inputMetric: 'characters',
          inputValue: characterCount,
        }, 'wall'))
      },
      image: (metadata) => {
        steps.push(withNormalizedTiming({
          step: 'image',
          provider: metadata.imageService,
          model: metadata.imageModel,
          processingTimeMs: roundMs(metadata.processingTime),
          inputMetric: 'images',
          inputValue: metadata.imageCount,
        }, 'wall'))
      },
      video: (metadata) => {
        steps.push(withNormalizedTiming({
          step: 'video',
          provider: metadata.videoGenService,
          model: metadata.videoGenModel,
          processingTimeMs: roundMs(metadata.processingTime),
          ...(typeof metadata.videoDuration === 'number'
            ? {
                inputMetric: 'durationSeconds',
                inputValue: metadata.videoDuration,
              }
            : {}),
        }, 'wall'))
      },
      music: (metadata) => {
        steps.push(withNormalizedTiming({
          step: 'music',
          provider: metadata.musicService,
          model: metadata.musicModel,
          processingTimeMs: roundMs(metadata.processingTime),
          ...(typeof metadata.musicDurationMs === 'number'
            ? {
                inputMetric: 'durationSeconds',
                inputValue: metadata.musicDurationMs / 1000,
              }
            : {}),
        }, 'wall'))
      }
    }
  })

  const sumOfStepProcessingTimeMs = steps.reduce((sum, step) => sum + step.processingTimeMs, 0)
  const totalProcessingTimeMs = computeTotalProcessingTimeMs(steps, input)

  return {
    totalProcessingTimeMs,
    ...(totalProcessingTimeMs !== sumOfStepProcessingTimeMs ? { sumOfStepProcessingTimeMs } : {}),
    steps,
  }
}
