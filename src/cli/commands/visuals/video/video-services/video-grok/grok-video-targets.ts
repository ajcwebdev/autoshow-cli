import type { GrokVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateGrokVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { UsageError } from '~/utils/error-handler'
import { runGrokVideoGen } from './run-grok-video-gen'
import { isSupportedOrSkippedForAllVideo, requireReferenceImagesForProvider } from '../../video-utils/video-mode-validation'
import { normalizeGrokVideoAspectRatio, normalizeGrokVideoDuration, normalizeGrokVideoResolution } from '../../video-utils/video-normalization'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

export const collectGrokVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.grokVideoModels ?? []

  return models.flatMap((rawModel) => {
    const model: GrokVideoModel = validateGrokVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'grok', model, mode, ['text', 'image-to-video', 'reference-to-video'])) {
      return []
    }
    const effective = {
      durationSeconds: normalizeGrokVideoDuration(options.videoDuration),
      aspectRatio: normalizeGrokVideoAspectRatio(options.videoAspectRatio),
      resolution: normalizeGrokVideoResolution(options.videoResolution, model)
    }
    if (mode === 'reference-to-video' && options.videoResolution === '1080p') {
      throw UsageError('Grok grok-imagine-video-1.5 reference-to-video is limited to 720p; use --resolution 720p or 480p.')
    }
    if (mode === 'reference-to-video') {
      requireReferenceImagesForProvider(options, 'grok', model)
    }
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--input-image', provider: 'grok', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--reference-image', provider: 'grok', model, kind: 'image', maxInputs: 5 })
    }

    const request = {
      model,
      mode,
      durationSeconds: options.videoDuration,
      aspectRatio: options.videoAspectRatio,
      resolution: options.videoResolution,
      inputImage: options.videoInputImage,
      referenceImages: options.videoReferenceImages
    }
    return [{
      service: 'grok',
      model,
      requestSettings: { ...request, effective },
      run: async (prompt, outputDir) => await runGrokVideoGen(prompt, outputDir, request)
    }]
  })
}
