import type { LumalabsVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateLumalabsVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError } from '~/utils/error-handler'
import { runLumalabsVideoGen } from './run-lumalabs-video-gen'
import { isSupportedOrSkippedForAllVideo } from '../../video-utils/video-mode-validation'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'
import { normalizeLumaVideoAspectRatio, normalizeLumaVideoResolution } from '../../video-utils/video-normalization'

export const collectLumalabsVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.lumalabsVideoModels ?? []
  return models.flatMap((rawModel) => {
    const model: LumalabsVideoModel = validateLumalabsVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'lumalabs', model, mode, ['text', 'image-to-video'])) {
      return []
    }
    normalizeLumaVideoAspectRatio(options.videoAspectRatio)
    normalizeLumaVideoResolution(options.videoResolution)
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'lumalabs', model, kind: 'image' })
    }

    return [{
      service: 'lumalabs',
      model,
      run: async (prompt, outputDir) => {
        if (prompt === undefined) {
          throw CLIUsageError('Luma Labs video prompt cannot be empty.')
        }
        return await runLumalabsVideoGen(prompt, outputDir, {
          model,
          durationSeconds: options.videoDuration,
          aspectRatio: options.videoAspectRatio,
          resolution: options.videoResolution,
          inputImage: options.videoInputImage
        })
      }
    }]
  })
}
