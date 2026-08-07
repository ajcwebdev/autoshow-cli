import type { GeminiVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateGeminiVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError } from '~/utils/error-handler'
import { runGeminiVideoGen } from './run-gemini-video-gen'
import { isSupportedOrSkippedForAllVideo, requireReferenceImagesForProvider } from '../../video-utils/video-mode-validation'
import { normalizeGeminiResolution } from '../../video-utils/video-normalization'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

const isGeminiStandardOrFast = (model: GeminiVideoModel): boolean =>
  model === 'veo-3.1-generate-preview' || model === 'veo-3.1-fast-generate-preview'

export const collectGeminiVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.geminiVideoModels ?? []
  return models.flatMap((rawModel) => {
    const model: GeminiVideoModel = validateGeminiVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'gemini', model, mode, ['text', 'image-to-video', 'reference-to-video', 'interpolate', 'extend'])) {
      return []
    }
    if ((mode === 'reference-to-video' || mode === 'extend') && !isGeminiStandardOrFast(model)) {
      if (options.allVideo) return []
      throw CLIUsageError(`--video-mode ${mode} is not supported by gemini/${model}. Use veo-3.1-generate-preview or veo-3.1-fast-generate-preview.`)
    }
    if (mode === 'reference-to-video') {
      requireReferenceImagesForProvider(options, 'gemini', model)
    }
    normalizeGeminiResolution(mode === 'extend' ? '720p' : options.videoResolution, model)
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'gemini', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--video-last-frame', provider: 'gemini', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'gemini', model, kind: 'image', maxInputs: 3 })
    }
    if (options.videoInputVideo) {
      validateVideoMediaReferences([options.videoInputVideo], { flagName: '--video-input-video', provider: 'gemini', model, kind: 'video' })
    }

    return [{
      service: 'gemini',
      model,
      run: async (prompt, outputDir) => {
        return await runGeminiVideoGen(prompt, outputDir, {
          model,
          mode,
          aspectRatio: options.videoAspectRatio,
          resolution: options.videoResolution,
          durationSeconds: options.videoDuration,
          inputImage: options.videoInputImage,
          lastFrameImage: options.videoLastFrame,
          referenceImages: options.videoReferenceImages,
          inputVideo: options.videoInputVideo
        })
      }
    }]
  })
}
