import type { AggregateTimingOptions, AggregatedPriceEstimate, ExtractStepEstimate, ImageStepEstimate, LlmStepEstimate, MusicStepEstimate, Step3Metadata, Step4Metadata, StepEstimate, SttStepEstimate, TimedExtractProvider, TimedImageService, TimedMusicService, TimedSttService, TimedVideoService, TtsStepEstimate, VideoStepEstimate } from '~/types'
import { computeEstimatedProcessingTimes } from '../compute-processing-time'

const TIMED_EXTRACT_PROVIDERS = new Set<TimedExtractProvider>([
  'tesseract',
  'defuddle',
  'mistral',
  'glm',
  'kimi',
  'openai',
  'grok',
  'anthropic',
  'gemini',
  'deepinfra',
  'firecrawl',
  'glm-reader',
  'spider',
  'zyte'
])

const isTimedExtractProvider = (provider: ExtractStepEstimate['provider']): provider is TimedExtractProvider =>
  TIMED_EXTRACT_PROVIDERS.has(provider as TimedExtractProvider)

export const buildAggregateTiming = (
  steps: StepEstimate[],
  ttsTimingCharacterCount: number | undefined,
  options: AggregateTimingOptions = {}
): AggregatedPriceEstimate['timing'] => {
  const sttTimingTargets = steps
    .filter((step): step is SttStepEstimate & { durationSeconds: number } =>
      step.step === 'stt' && typeof step.durationSeconds === 'number' && step.durationSeconds > 0
    )
    .map((step) => ({
      service: step.provider as TimedSttService,
      model: step.model
    }))
  const sttTimingDurationSeconds = steps
    .find((step): step is SttStepEstimate & { durationSeconds: number } =>
      step.step === 'stt' && typeof step.durationSeconds === 'number' && step.durationSeconds > 0
    )?.durationSeconds
  const extractTimingTargets = steps
    .filter((step): step is ExtractStepEstimate & { provider: TimedExtractProvider, pageCount: number } =>
      step.step === 'extract' && isTimedExtractProvider(step.provider) && typeof step.pageCount === 'number'
    )
    .map((step) => ({
      provider: step.provider,
      model: step.model,
      pageCount: step.pageCount,
      ...(step.ocrProviderMode ? { ocrProviderMode: step.ocrProviderMode } : {}),
      ...(typeof step.rasterizedPages === 'number' ? { rasterizedPages: step.rasterizedPages } : {}),
      ...(typeof step.singlePagePdfFallbackPages === 'number' ? { singlePagePdfFallbackPages: step.singlePagePdfFallbackPages } : {})
    }))
  const ttsTimingTargets = steps
    .filter((step): step is TtsStepEstimate & { characterCount: number } =>
      step.step === 'tts' && typeof step.characterCount === 'number'
    )
    .map((step) => ({
      service: step.provider as Step4Metadata['ttsService'],
      model: step.model,
      ...(typeof step.setupTimeMs === 'number' ? { setupTimeMs: step.setupTimeMs } : {}),
      ...(typeof step.chunkConcurrency === 'number' ? { chunkConcurrency: step.chunkConcurrency } : {})
    }))
  const llmTimingTargets = steps
    .filter((step): step is LlmStepEstimate =>
      step.step === 'llm'
      && ((step.estimatedInputTokens ?? 0) + (step.estimatedOutputTokens ?? 0)) > 0
    )
    .map((step) => ({
      service: step.provider as Step3Metadata['llmService'],
      model: step.model,
      inputTokens: step.estimatedInputTokens ?? 0,
      outputTokens: step.estimatedOutputTokens ?? 0
    }))
  const imageTimingTargets = steps
    .filter((step): step is ImageStepEstimate =>
      step.step === 'image' && step.imageCount > 0
    )
    .map((step) => ({
      service: step.provider as TimedImageService,
      model: step.model,
      count: step.imageCount
    }))
  const videoTimingTargets = steps
    .filter((step): step is VideoStepEstimate =>
      step.step === 'video' && step.durationSeconds > 0
    )
    .map((step) => ({
      service: step.provider as TimedVideoService,
      model: step.model,
      durationSeconds: step.durationSeconds
    }))
  const musicTimingTargets = steps
    .filter((step): step is MusicStepEstimate =>
      step.step === 'music' && step.durationSeconds > 0
    )
    .map((step) => ({
      service: step.provider as TimedMusicService,
      model: step.model,
      durationSeconds: step.durationSeconds
    }))

  return (sttTimingTargets.length > 0 && typeof sttTimingDurationSeconds === 'number')
    || extractTimingTargets.length > 0
    || llmTimingTargets.length > 0
    || (ttsTimingTargets.length > 0 && typeof ttsTimingCharacterCount === 'number')
    || imageTimingTargets.length > 0
    || videoTimingTargets.length > 0
    || musicTimingTargets.length > 0
    ? computeEstimatedProcessingTimes({
        ...(sttTimingTargets.length > 0 && typeof sttTimingDurationSeconds === 'number'
          ? {
              sttTargets: sttTimingTargets,
              audioDurationSeconds: sttTimingDurationSeconds
            }
          : {}),
        ...(extractTimingTargets.length > 0 ? { extractTargets: extractTimingTargets } : {}),
        ...(typeof options.ocrConcurrency === 'number' ? { ocrConcurrency: options.ocrConcurrency } : {}),
        ...(options.ocrConcurrencyMode ? { ocrConcurrencyMode: options.ocrConcurrencyMode } : {}),
        ...(typeof options.ocrProviderConcurrency === 'number' ? { ocrProviderConcurrency: options.ocrProviderConcurrency } : {}),
        ...(typeof options.ocrLocalConcurrency === 'number' ? { ocrLocalConcurrency: options.ocrLocalConcurrency } : {}),
        ...(llmTimingTargets.length > 0 ? { llmTargets: llmTimingTargets } : {}),
        ...(ttsTimingTargets.length > 0 && typeof ttsTimingCharacterCount === 'number'
          ? {
              ttsTargets: ttsTimingTargets,
              ttsCharacterCount: ttsTimingCharacterCount,
              ...(typeof options.ttsInputText === 'string' ? { ttsInputText: options.ttsInputText } : {}),
              ...(typeof options.ttsChunkConcurrency === 'number' ? { ttsChunkConcurrency: options.ttsChunkConcurrency } : {})
            }
          : {}),
        ...(imageTimingTargets.length > 0 ? { imageTargets: imageTimingTargets } : {}),
        ...(videoTimingTargets.length > 0 ? { videoTargets: videoTimingTargets } : {}),
        ...(musicTimingTargets.length > 0 ? { musicTargets: musicTimingTargets } : {})
      })
    : undefined
}
