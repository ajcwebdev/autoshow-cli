import type { GrokVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateGrokVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { UsageError } from '~/utils/error-handler'
import { runGrokVideoGen } from './run-grok-video-gen'
import { hasValue, isSupportedOrSkippedForAllVideo, requireReferenceImagesForProvider } from '../../video-utils/video-mode-validation'
import { normalizeGrokVideoResolution } from '../../video-utils/video-normalization'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

export const collectGrokVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.grokVideoModels ?? []

  return models.flatMap((rawModel) => {
    const model: GrokVideoModel = validateGrokVideoModel(rawModel)
    const supportedModes: readonly VideoMode[] = model === 'grok-imagine-video-1.5'
      ? ['text', 'image-to-video', 'reference-to-video']
      : ['text', 'image-to-video', 'reference-to-video', 'extend', 'edit']
    if (!isSupportedOrSkippedForAllVideo(options, 'grok', model, mode, supportedModes)) {
      return []
    }
    if (mode !== 'edit') {
      normalizeGrokVideoResolution(options.videoResolution, model)
    }
    if (model === 'grok-imagine-video-1.5' && mode === 'reference-to-video' && options.videoResolution === '1080p') {
      throw UsageError('Grok grok-imagine-video-1.5 reference-to-video is limited to 720p; use --resolution 720p or 480p.')
    }
    if (mode === 'edit' && (hasValue(options.videoDuration) || hasValue(options.videoAspectRatio) || hasValue(options.videoResolution))) {
      throw UsageError('--duration, --aspect-ratio, and --resolution are not valid with Grok --mode edit.')
    }
    if (mode === 'reference-to-video') {
      requireReferenceImagesForProvider(options, 'grok', model)
    }
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--input-image', provider: 'grok', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--reference-image', provider: 'grok', model, kind: 'image', maxInputs: model === 'grok-imagine-video-1.5' ? 5 : 3 })
    }
    if (options.videoInputVideo) {
      validateVideoMediaReferences([options.videoInputVideo], { flagName: '--input-video', provider: 'grok', model, kind: 'video' })
    }

    return [{
      service: 'grok',
      model,
      run: async (prompt, outputDir) => {
        return await runGrokVideoGen(prompt, outputDir, {
          model,
          mode,
          durationSeconds: options.videoDuration,
          aspectRatio: options.videoAspectRatio,
          resolution: options.videoResolution,
          inputImage: options.videoInputImage,
          referenceImages: options.videoReferenceImages,
          inputVideo: options.videoInputVideo
        })
      }
    }]
  })
}
