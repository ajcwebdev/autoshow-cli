import type { GeminiVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateGeminiVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runGeminiVideoGen } from './run-gemini-video-gen'
import { isSupportedOrSkippedForAllVideo } from '../../video-utils/video-mode-validation'
import { normalizeGeminiResolution } from '../../video-utils/video-normalization'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

export const collectGeminiVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.geminiVideoModels ?? []
  return models.flatMap((rawModel) => {
    const model: GeminiVideoModel = validateGeminiVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'gemini', model, mode, ['text', 'image-to-video', 'interpolate'])) {
      return []
    }
    normalizeGeminiResolution(options.videoResolution, model)
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--input-image', provider: 'gemini', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--last-frame', provider: 'gemini', model, kind: 'image' })
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
          lastFrameImage: options.videoLastFrame
        })
      }
    }]
  })
}
