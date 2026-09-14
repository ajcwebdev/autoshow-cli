import type { LtxVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateLtxVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runLtxVideoGen } from './run-ltx-video-gen'
import { isSupportedOrSkippedForAllVideo } from '../../video-utils/video-mode-validation'
import { normalizeLtxVideoSize, normalizeLtxVideoDuration } from '../../video-utils/video-normalization'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

export const collectLtxVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.ltxVideoModels ?? []
  return models.flatMap((rawModel) => {
    const model: LtxVideoModel = validateLtxVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'ltx', model, mode, ['text', 'image-to-video', 'interpolate'])) {
      return []
    }
    const size = normalizeLtxVideoSize(model, options.videoResolution, options.videoAspectRatio)
    normalizeLtxVideoDuration(model, size, options.videoDuration, mode)
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--input-image', provider: 'ltx', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--last-frame', provider: 'ltx', model, kind: 'image' })
    }

    return [{
      service: 'ltx',
      model,
      run: async (prompt, outputDir) => {
        return await runLtxVideoGen(prompt, outputDir, {
          model,
          mode,
          durationSeconds: options.videoDuration,
          aspectRatio: options.videoAspectRatio,
          resolution: options.videoResolution,
          inputImage: options.videoInputImage,
          lastFrameImage: options.videoLastFrame
        })
      }
    }]
  })
}
