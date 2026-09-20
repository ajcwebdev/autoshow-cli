import type { GeminiVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateGeminiVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { UsageError } from '~/utils/error-handler'
import { runGeminiVideoGen } from './run-gemini-video-gen'
import { isSupportedOrSkippedForAllVideo } from '../../video-utils/video-mode-validation'
import { normalizeGeminiAspectRatio, normalizeGeminiDuration, normalizeGeminiResolution } from '../../video-utils/video-normalization'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

const OMNI_MODES: readonly VideoMode[] = [
  'text',
  'image-to-video',
  'interpolate',
  'reference-to-video',
  'edit',
  'extend'
]

export const collectGeminiVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.geminiVideoModels ?? []
  return models.flatMap((rawModel) => {
    const model: GeminiVideoModel = validateGeminiVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'gemini', model, mode, OMNI_MODES)) {
      return []
    }
    const effective = {
      resolution: normalizeGeminiResolution(options.videoResolution, model),
      aspectRatio: normalizeGeminiAspectRatio(options.videoAspectRatio),
      durationSeconds: normalizeGeminiDuration(options.videoDuration, options.videoResolution, mode)
    }
    if (mode === 'reference-to-video' && (options.videoReferenceAudios?.length ?? 0) > 0) {
      throw UsageError(`--reference-audio is not supported by gemini/${model}.`)
    }
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--input-image', provider: 'gemini', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--last-frame', provider: 'gemini', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--reference-image', provider: 'gemini', model, kind: 'image' })
    }
    if (options.videoReferenceVideos) {
      validateVideoMediaReferences(options.videoReferenceVideos, { flagName: '--reference-video', provider: 'gemini', model, kind: 'video', maxInputs: 3 })
    }
    if (options.videoInputVideo) {
      validateVideoMediaReferences([options.videoInputVideo], { flagName: '--input-video', provider: 'gemini', model, kind: 'video' })
    }

    const request = {
      model,
      mode,
      aspectRatio: options.videoAspectRatio,
      resolution: options.videoResolution,
      durationSeconds: options.videoDuration,
      inputImage: options.videoInputImage,
      lastFrameImage: options.videoLastFrame,
      referenceImages: options.videoReferenceImages,
      referenceVideos: options.videoReferenceVideos,
      inputVideo: options.videoInputVideo,
      previousInteractionId: options.videoPreviousInteractionId
    }
    return [{
      service: 'gemini',
      model,
      requestSettings: { ...request, effective },
      run: async (prompt, outputDir) => await runGeminiVideoGen(prompt, outputDir, request)
    }]
  })
}
