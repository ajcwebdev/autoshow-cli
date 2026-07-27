import { resolveReverbModelLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-model-labels'
import type { ComputeActualProcessingTimesInput, ComputeEstimatedProcessingTimesInput, EstimateConfidence, ExtractionMetadata, Step2Metadata, StepTimingBreakdown, TimingBreakdown, TimingStepEntry } from '~/types'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'
import { toArray } from '~/utils/text-utils'
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

const WHISPER_MODEL_PATH_PATTERN = /ggml-([a-z0-9.-]+)\.bin/i

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

const isTranscriptionMetadata = (value: unknown): value is Step2Metadata => {
  return typeof value === 'object' && value !== null && 'transcriptionService' in value
}

const isExtractionMetadata = (value: unknown): value is ExtractionMetadata => {
  return typeof value === 'object' && value !== null && 'extractionMethod' in value
}

const resolveTranscriptionModel = (metadata: Step2Metadata): string => {
  if (metadata.transcriptionService === 'reverb') {
    return resolveReverbModelLabel(metadata.transcriptionModel)
  }
  if (metadata.transcriptionService !== 'whisper') {
    return metadata.transcriptionModel
  }

  const match = metadata.transcriptionModel.match(WHISPER_MODEL_PATH_PATTERN)
  if (match && typeof match[1] === 'string' && match[1].length > 0) {
    return match[1]
  }

  return metadata.transcriptionModel
}

const computeEstimatedTotalProcessingTimeMs = (
  steps: TimingStepEntry[],
  input: ComputeEstimatedProcessingTimesInput
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

const computeActualTotalProcessingTimeMs = (
  steps: TimingStepEntry[],
  input: ComputeActualProcessingTimesInput
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
    totalProcessingTimeMs: computeEstimatedTotalProcessingTimeMs(steps, input),
    steps,
    estimateConfidence,
    ...(buildLikelyGatingTargets(steps) ? { likelyGatingTargets: buildLikelyGatingTargets(steps) } : {})
  }
}

export const computeActualProcessingTimes = (
  input: ComputeActualProcessingTimesInput
): StepTimingBreakdown => {
  const steps: TimingStepEntry[] = []

  if (Array.isArray(input.step2)) {
    if (input.step2.every(isExtractionMetadata)) {
      for (const step2Entry of input.step2) {
        const { provider, model } = resolveExtractionProviderModel(step2Entry)
        steps.push(withNormalizedTiming({
          step: 'extract',
          provider,
          model,
          processingTimeMs: roundMs(step2Entry.processingTime),
          inputMetric: step2Entry.extractionMethod === 'epub-text' ? 'sections' : 'pages',
          inputValue: step2Entry.totalPages,
        }, 'wall'))
      }
    } else {
      for (const step2Entry of input.step2) {
        const model = resolveTranscriptionModel(step2Entry)
        const timingBreakdown = normalizeTimingBreakdown(step2Entry.timings)
        steps.push(withNormalizedTiming({
          step: 'stt',
          provider: step2Entry.transcriptionService,
          model,
          processingTimeMs: roundMs(step2Entry.processingTime),
          ...(timingBreakdown ? { timingBreakdown } : {}),
          ...(typeof input.audioDurationSeconds === 'number'
            ? {
                inputMetric: 'durationSeconds' as const,
                inputValue: input.audioDurationSeconds,
              }
            : {
                inputMetric: 'tokens' as const,
                inputValue: step2Entry.tokenCount,
              }),
        }, 'wall'))
      }
    }
  } else if (input.step2 && isTranscriptionMetadata(input.step2)) {
    const model = resolveTranscriptionModel(input.step2)
    const timingBreakdown = normalizeTimingBreakdown(input.step2.timings)
    steps.push(withNormalizedTiming({
      step: 'stt',
      provider: input.step2.transcriptionService,
      model,
      processingTimeMs: roundMs(input.step2.processingTime),
      ...(timingBreakdown ? { timingBreakdown } : {}),
      ...(typeof input.audioDurationSeconds === 'number'
        ? {
            inputMetric: 'durationSeconds',
            inputValue: input.audioDurationSeconds,
          }
        : {
            inputMetric: 'tokens',
            inputValue: input.step2.tokenCount,
          }),
    }, 'wall'))
  } else if (
    input.step2
    && isExtractionMetadata(input.step2)
  ) {
    const { provider, model } = resolveExtractionProviderModel(input.step2)
    steps.push(withNormalizedTiming({
      step: 'extract',
      provider,
      model,
      processingTimeMs: roundMs(input.step2.processingTime),
      inputMetric: input.step2.extractionMethod === 'epub-text' ? 'sections' : 'pages',
      inputValue: input.step2.totalPages,
    }, 'wall'))
  }

  for (const partialStep2Entry of toArray(input.partialStep2)) {
    const { provider, model } = resolveExtractionProviderModel(partialStep2Entry)
    steps.push(withNormalizedTiming({
      step: 'extract',
      provider,
      model,
      processingTimeMs: roundMs(partialStep2Entry.processingTime),
      inputMetric: 'pages',
      inputValue: partialStep2Entry.completedPages,
      timingNote: 'Partial failed provider; timing covers cached page artifacts through failure.'
    }, 'wall'))
  }

  for (const step3 of toArray(input.step3)) {
    const tokenCount = step3.inputTokenCount + step3.outputTokenCount
    steps.push(withNormalizedTiming({
      step: 'llm',
      provider: step3.llmService,
      model: step3.llmModel,
      processingTimeMs: roundMs(step3.processingTime),
      inputMetric: 'tokens',
      inputValue: tokenCount,
    }, 'wall'))
  }

  const step4Array = toArray(input.step4)

  if (step4Array.length > 0 && typeof input.ttsCharacterCount === 'number') {
    for (const step4 of step4Array) {
      steps.push(withNormalizedTiming({
        step: 'tts',
        provider: step4.ttsService,
        model: step4.ttsModel,
        processingTimeMs: roundMs(step4.processingTime),
        inputMetric: 'characters',
        inputValue: input.ttsCharacterCount,
      }, 'wall'))
    }
  }

  for (const step5 of toArray(input.step5)) {
    steps.push(withNormalizedTiming({
      step: 'image',
      provider: step5.imageService,
      model: step5.imageModel,
      processingTimeMs: roundMs(step5.processingTime),
      inputMetric: 'images',
      inputValue: step5.imageCount,
    }, 'wall'))
  }

  for (const s6 of toArray(input.step6)) {
    steps.push(withNormalizedTiming({
      step: 'video',
      provider: s6.videoGenService,
      model: s6.videoGenModel,
      processingTimeMs: roundMs(s6.processingTime),
      ...(typeof s6.videoDuration === 'number'
        ? {
            inputMetric: 'durationSeconds',
            inputValue: s6.videoDuration,
          }
        : {}),
    }, 'wall'))
  }

  if (input.step7) {
    for (const item of toArray(input.step7)) {
      steps.push(withNormalizedTiming({
        step: 'music',
        provider: item.musicService,
        model: item.musicModel,
        processingTimeMs: roundMs(item.processingTime),
        ...(typeof item.musicDurationMs === 'number'
          ? {
              inputMetric: 'durationSeconds',
              inputValue: item.musicDurationMs / 1000,
            }
          : {}),
      }, 'wall'))
    }
  }

  const sumOfStepProcessingTimeMs = steps.reduce((sum, step) => sum + step.processingTimeMs, 0)
  const totalProcessingTimeMs = computeActualTotalProcessingTimeMs(steps, input)

  return {
    totalProcessingTimeMs,
    ...(totalProcessingTimeMs !== sumOfStepProcessingTimeMs ? { sumOfStepProcessingTimeMs } : {}),
    steps,
  }
}
