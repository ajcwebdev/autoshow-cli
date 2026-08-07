import type { FalVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateFalVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError } from '~/utils/error-handler'
import { isSupportedOrSkippedForAllVideo } from '../../video-utils/video-mode-validation'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'
import { normalizeFalVideoAspectRatio, normalizeFalVideoDuration, normalizeFalVideoResolution, runFalVideoGen } from './run-fal-video-gen'

export const collectFalVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.falVideoModels ?? (options.falVideoModel ? [options.falVideoModel] : [])
  const hasFalSpecificOptions = options.falVideoGenerateAudio !== undefined
    || (options.falVideoReferenceVideos?.length ?? 0) > 0
    || (options.falVideoReferenceAudios?.length ?? 0) > 0
  if (hasFalSpecificOptions && models.length === 0) throw CLIUsageError('fal.ai video flags require a fal.ai video provider target.')
  return models.flatMap((rawModel) => {
    const model: FalVideoModel = validateFalVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'fal', model, mode, ['text', 'image-to-video', 'reference-to-video', 'interpolate'])) return []
    if (options.videoSize) throw CLIUsageError(`--video-size is not supported by fal.ai/${model}; use --video-resolution.`)
    normalizeFalVideoDuration(model, options.videoDuration)
    normalizeFalVideoResolution(model, options.videoResolution)
    normalizeFalVideoAspectRatio(model, options.videoAspectRatio, mode)
    if (options.videoInputImage) validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'fal', model, kind: 'image' })
    if (options.videoLastFrame) validateVideoMediaReferences([options.videoLastFrame], { flagName: '--video-last-frame', provider: 'fal', model, kind: 'image' })
    validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'fal', model, kind: 'image', maxInputs: model === 'minimax/h3' ? 9 : 7 })
    validateVideoMediaReferences(options.falVideoReferenceVideos, { flagName: '--fal-video-reference-video', provider: 'fal', model, kind: 'video', maxInputs: 3 })
    validateVideoMediaReferences(options.falVideoReferenceAudios, { flagName: '--fal-video-reference-audio', provider: 'fal', model, kind: 'audio', maxInputs: 3 })
    if (model === 'fal-ai/pixverse/c1' && ((options.falVideoReferenceVideos?.length ?? 0) || (options.falVideoReferenceAudios?.length ?? 0))) throw CLIUsageError(`fal.ai/${model} reference-to-video accepts image references only.`)
    const totalReferences = (options.videoReferenceImages?.length ?? 0) + (options.falVideoReferenceVideos?.length ?? 0) + (options.falVideoReferenceAudios?.length ?? 0)
    if (model === 'minimax/h3' && totalReferences > 12) throw CLIUsageError(`fal.ai/${model} supports at most 12 combined image, video, and audio references.`)
    if (model === 'minimax/h3' && (options.falVideoReferenceAudios?.length ?? 0) > 0 && (options.videoReferenceImages?.length ?? 0) + (options.falVideoReferenceVideos?.length ?? 0) === 0) throw CLIUsageError(`--fal-video-reference-audio requires at least one image or video reference for fal.ai/${model}.`)
    if (mode === 'reference-to-video' && model === 'fal-ai/pixverse/c1' && (options.videoReferenceImages?.length ?? 0) === 0) throw CLIUsageError(`--video-mode reference-to-video requires --video-reference-image for fal.ai/${model}.`)
    if (mode === 'reference-to-video' && model === 'minimax/h3' && totalReferences === 0) throw CLIUsageError(`--video-mode reference-to-video requires at least one fal.ai image, video, or audio reference for fal.ai/${model}.`)
    return [{
      service: 'fal',
      model,
      run: async (prompt, outputDir) => {
        if (prompt === undefined) throw CLIUsageError('fal.ai video prompt cannot be empty.')
        return await runFalVideoGen(prompt, outputDir, { model, mode, duration: options.videoDuration, resolution: options.videoResolution, aspectRatio: options.videoAspectRatio, inputImage: options.videoInputImage, lastFrame: options.videoLastFrame, referenceImages: options.videoReferenceImages, referenceVideos: options.falVideoReferenceVideos, referenceAudios: options.falVideoReferenceAudios, generateAudio: options.falVideoGenerateAudio })
      }
    }]
  })
}
