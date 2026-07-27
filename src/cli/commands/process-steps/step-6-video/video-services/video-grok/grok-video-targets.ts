import type { GrokVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateGrokVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError } from '~/utils/error-handler'
import { runGrokVideoGen } from './run-grok-video-gen'
import { hasValue, isSupportedOrSkippedForAllVideo, requireReferenceImagesForProvider } from '../../video-utils/video-mode-validation'
import { normalizeGrokVideoResolution } from '../../video-utils/video-normalization'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

export const collectGrokVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.grokVideoModels ?? (options.grokVideoModel ? [options.grokVideoModel] : [])
  const hasGrokStorageControls = options.grokVideoStorageFilename || options.grokVideoStorageExpiresAfter !== undefined
  if (hasGrokStorageControls && models.length === 0) {
    throw CLIUsageError('Grok video storage flags require a Grok video provider target.')
  }

  return models.flatMap((rawModel) => {
    const model: GrokVideoModel = validateGrokVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'grok', model, mode, ['text', 'image-to-video', 'reference-to-video', 'extend', 'edit'])) {
      return []
    }
    if (mode !== 'edit') {
      normalizeGrokVideoResolution(options.videoResolution)
    }
    if (mode === 'edit' && (hasValue(options.videoDuration) || hasValue(options.videoAspectRatio) || hasValue(options.videoResolution))) {
      throw CLIUsageError('--video-duration, --video-aspect-ratio, and --video-resolution are not valid with Grok --video-mode edit.')
    }
    if (mode === 'reference-to-video') {
      requireReferenceImagesForProvider(options, 'grok', model)
    }
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'grok', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'grok', model, kind: 'image', maxInputs: 3 })
    }
    if (options.videoInputVideo) {
      validateVideoMediaReferences([options.videoInputVideo], { flagName: '--video-input-video', provider: 'grok', model, kind: 'video' })
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
          inputVideo: options.videoInputVideo,
          storageFilename: options.grokVideoStorageFilename,
          storageExpiresAfter: options.grokVideoStorageExpiresAfter
        })
      }
    }]
  })
}
