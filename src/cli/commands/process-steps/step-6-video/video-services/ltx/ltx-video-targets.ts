import type { LtxVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateLtxVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runLtxVideoGen } from './run-ltx-video-gen'
import { isSupportedOrSkippedForAllVideo } from '../../video-utils/video-mode-validation'
import { normalizeLtxVideoSize } from '../../video-utils/video-normalization'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

const getLtxSupportedVideoModes = (model: LtxVideoModel): readonly VideoMode[] => {
  const modes: VideoMode[] = ['text', 'image-to-video', 'interpolate']
  if (model === 'ltx-2-3-pro') modes.push('extend')
  return modes
}

export const collectLtxVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.ltxVideoModels ?? []
  return models.flatMap((rawModel) => {
    const model: LtxVideoModel = validateLtxVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'ltx', model, mode, getLtxSupportedVideoModes(model))) {
      return []
    }
    normalizeLtxVideoSize(model, options.videoResolution, options.videoAspectRatio)
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'ltx', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--video-last-frame', provider: 'ltx', model, kind: 'image' })
    }
    if (options.videoInputVideo) {
      validateVideoMediaReferences([options.videoInputVideo], { flagName: '--video-input-video', provider: 'ltx', model, kind: 'video' })
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
          lastFrameImage: options.videoLastFrame,
          inputVideo: options.videoInputVideo
        })
      }
    }]
  })
}
