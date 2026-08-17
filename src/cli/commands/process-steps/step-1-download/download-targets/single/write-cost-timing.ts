import { buildEstimatedTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { getExpectedImageCount } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import type { ComputeWriteCostAndTimingContext } from '~/types'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'

export const computeWriteCostAndTiming = async (ctx: ComputeWriteCostAndTimingContext) => {
  const {
    processingOptions,
    preflightEstimate,
    step1Metadata,
    transcriptionResult,
    mediaDurationSeconds,
    step3Results,
    step3Serialized,
    ttsCharacterCount,
    ttsInputText,
    attemptedTtsTargets,
    attemptedImageTargets,
    attemptedVideoTargets,
    attemptedMusicTargets,
    step4Metadata,
    step5Metadata,
    step6Metadata,
    step7Metadata
  } = ctx

  const ttsEstimateTargets = buildEstimatedTtsTargets(attemptedTtsTargets)
  const imageEstimateTargets = attemptedImageTargets.map((target) => ({
    service: target.service,
    model: target.model,
    count: getExpectedImageCount(target, processingOptions)
  }))
  const llmTargets = step3Results.map((s3) => ({
    service: s3.llmService,
    model: s3.llmModel,
    inputTokens: s3.inputTokenCount,
    outputTokens: s3.outputTokenCount
  }))
  const step2EntriesForEstimation = Array.isArray(transcriptionResult.metadata)
    ? transcriptionResult.metadata
    : [transcriptionResult.metadata]
  const selectedSttTargets = step2EntriesForEstimation.map((entry) => ({
    service: entry.transcriptionService,
    model: entry.transcriptionModel
  }))

  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    sttTargets: selectedSttTargets,
    audioDurationSeconds: mediaDurationSeconds,
    sourceUrl: processingOptions.url,
    llmTargets,
    skipLLM: processingOptions.skipLLM,
    ttsTargets: ttsEstimateTargets,
    ttsCharacterCount,
    imageTargets: imageEstimateTargets,
    imageSize: processingOptions.imageSize,
    imageQuality: processingOptions.imageQuality,
    videoTargets: attemptedVideoTargets.map((target) => ({
      service: target.service,
      model: target.model,
      ...(processingOptions.videoDuration !== undefined ? { durationSeconds: processingOptions.videoDuration } : {})
    })),
    videoDuration: processingOptions.videoDuration,
    videoAspectRatio: processingOptions.videoAspectRatio,
    videoResolution: processingOptions.videoResolution,
    videoMode: processingOptions.videoMode,
    musicTargets: attemptedMusicTargets.map((t) => ({
      service: t.service,
      model: t.model,
      ...(processingOptions.musicDuration !== undefined ? { durationSeconds: processingOptions.musicDuration } : {})
    })),
    musicDuration: processingOptions.musicDuration,
    musicLyricsFile: processingOptions.musicLyricsFile,
    musicInstrumental: processingOptions.musicInstrumental
  })
  const priceEstimateTarget = processingOptions.url ?? processingOptions.filePath ?? step1Metadata.url
  const priceAlignedEstimate = preflightEstimate ?? await buildAggregatedPriceEstimate(
    'write',
    priceEstimateTarget,
    processingOptions
  )
  const estimated = preflightToEstimated(priceAlignedEstimate)

  const actual = computeActualCosts({
    step1: step1Metadata,
    step2: transcriptionResult.metadata,
    audioDurationSeconds: mediaDurationSeconds,
    ...(step3Serialized !== undefined ? { step3: step3Serialized } : {}),
    ...(step4Metadata ? { step4: step4Metadata, ttsCharacterCount } : {}),
    ...(step5Metadata ? { step5: step5Metadata } : {}),
    ...(step6Metadata ? { step6: step6Metadata } : {}),
    ...(step7Metadata ? { step7: step7Metadata } : {})
  })

  const cost = { estimated, observedEstimate, actual }
  const fallbackEstimatedTiming = computeEstimatedProcessingTimes({
    sttTargets: selectedSttTargets,
    audioDurationSeconds: mediaDurationSeconds,
    llmTargets,
    skipLLM: processingOptions.skipLLM,
    ttsTargets: ttsEstimateTargets,
    ttsCharacterCount,
    ...(ttsInputText !== undefined ? { ttsInputText } : {}),
    ttsChunkConcurrency: processingOptions.ttsChunkConcurrency,
    ...(imageEstimateTargets.length > 0 ? { imageTargets: imageEstimateTargets } : {}),
    ...(attemptedVideoTargets.length > 0
      ? {
          videoTargets: attemptedVideoTargets.map((t) => ({
            service: t.service,
            model: t.model,
            ...(processingOptions.videoDuration !== undefined ? { durationSeconds: processingOptions.videoDuration } : {})
          })),
          ...(processingOptions.videoAspectRatio !== undefined ? { videoAspectRatio: processingOptions.videoAspectRatio } : {}),
          ...(processingOptions.videoResolution !== undefined ? { videoResolution: processingOptions.videoResolution } : {}),
          ...(processingOptions.videoMode !== undefined ? { videoMode: processingOptions.videoMode } : {})
        }
      : {}),
    ...(attemptedMusicTargets.length > 0
      ? {
          musicTargets: attemptedMusicTargets.map((t) => ({
            service: t.service,
            model: t.model,
            ...(processingOptions.musicDuration !== undefined ? { durationSeconds: processingOptions.musicDuration } : {})
          }))
        }
      : {}),
  })
  const estimatedTiming = priceAlignedEstimate.timing ?? fallbackEstimatedTiming
  const actualTiming = computeActualProcessingTimes({
    audioDurationSeconds: mediaDurationSeconds,
    step2: transcriptionResult.metadata,
    ...(step3Serialized !== undefined ? { step3: step3Serialized } : {}),
    ...(step4Metadata ? { step4: step4Metadata, ttsCharacterCount } : {}),
    ...(step5Metadata ? { step5: step5Metadata } : {}),
    ...(step6Metadata ? { step6: step6Metadata } : {}),
    ...(step7Metadata ? { step7: step7Metadata } : {}),
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  return { cost, timing }
}
