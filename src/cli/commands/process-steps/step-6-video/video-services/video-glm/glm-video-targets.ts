import type { GlmVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateGlmVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runGlmVideoGen } from './run-glm-video-gen'
import { isSupportedOrSkippedForAllVideo, requireReferenceImagesForProvider } from '../../video-utils/video-mode-validation'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

const getGlmSupportedVideoModes = (model: GlmVideoModel): readonly VideoMode[] => {
  if (model === 'cogvideox-3') return ['text', 'image-to-video', 'interpolate']
  if (model === 'viduq1-text') return ['text']
  if (model === 'vidu2-image') return ['image-to-video']
  if (model === 'vidu2-start-end') return ['interpolate']
  if (model === 'vidu2-reference') return ['reference-to-video']
  return ['text']
}

export const collectGlmVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.glmVideoModels ?? []
  return models.flatMap((rawModel) => {
    const model: GlmVideoModel = validateGlmVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'glm', model, mode, getGlmSupportedVideoModes(model))) {
      return []
    }
    if (mode === 'reference-to-video') {
      requireReferenceImagesForProvider(options, 'glm', model)
    }
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'glm', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--video-last-frame', provider: 'glm', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'glm', model, kind: 'image', maxInputs: 3 })
    }

    return [{
      service: 'glm',
      model,
      run: async (prompt, outputDir) => {
        return await runGlmVideoGen(prompt, outputDir, {
          model,
          mode,
          durationSeconds: options.videoDuration,
          size: options.videoSize,
          aspectRatio: options.videoAspectRatio,
          inputImage: options.videoInputImage,
          lastFrameImage: options.videoLastFrame,
          referenceImages: options.videoReferenceImages
        })
      }
    }]
  })
}
