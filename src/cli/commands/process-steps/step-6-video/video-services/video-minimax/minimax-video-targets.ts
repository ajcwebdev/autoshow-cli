import type { MinimaxVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateMinimaxVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError } from '~/utils/error-handler'
import { runMinimaxVideoGen } from './run-minimax-video-gen'
import { isSupportedOrSkippedForAllVideo, requireReferenceImagesForProvider } from '../../video-utils/video-mode-validation'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

const getMinimaxSupportedVideoModes = (model: MinimaxVideoModel): readonly VideoMode[] => {
  if (model === 'S2V-01') return ['reference-to-video']
  if (model === 'MiniMax-Hailuo-2.3') return ['text', 'image-to-video']
  if (model === 'MiniMax-Hailuo-2.3-Fast' || model === 'I2V-01' || model === 'I2V-01-Director' || model === 'I2V-01-live') return ['image-to-video']
  return ['text']
}

export const collectMinimaxVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.minimaxVideoModels ?? []
  return models.flatMap((rawModel) => {
    const model: MinimaxVideoModel = validateMinimaxVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'minimax', model, mode, getMinimaxSupportedVideoModes(model))) {
      return []
    }
    if (mode === 'reference-to-video' && (options.videoReferenceImages?.length ?? 0) > 1) {
      throw CLIUsageError('MiniMax S2V-01 supports exactly one --video-reference-image.')
    }
    if (mode === 'reference-to-video') {
      requireReferenceImagesForProvider(options, 'minimax', model)
    }
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'minimax', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--video-last-frame', provider: 'minimax', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'minimax', model, kind: 'image', maxInputs: 1 })
    }

    return [{
      service: 'minimax',
      model,
      run: async (prompt, outputDir) => {
        return await runMinimaxVideoGen(prompt, outputDir, {
          model,
          mode,
          durationSeconds: options.videoDuration,
          resolution: options.videoResolution,
          inputImage: options.videoInputImage,
          lastFrameImage: options.videoLastFrame,
          referenceImages: options.videoReferenceImages
        })
      }
    }]
  })
}
