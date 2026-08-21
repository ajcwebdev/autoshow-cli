import type { ReplicateVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateReplicateVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError } from '~/utils/error-handler'
import { runReplicateVideoGen } from './run-replicate-video-gen'
import { hasValue, isSupportedOrSkippedForAllVideo } from '../../video-utils/video-mode-validation'
import {
  isReplicateHappyHorseVideoModel,
  isReplicateKlingOmniVideoModel,
  isReplicateKlingVideoModel,
  isReplicatePixVerseVideoModel,
  isReplicateSeedanceVideoModel,
  normalizeReplicateVideoAspectRatio,
  normalizeReplicateVideoDuration,
  normalizeReplicateVideoResolution
} from '../../video-utils/video-normalization'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

const getReplicateSupportedVideoModes = (model: ReplicateVideoModel): readonly VideoMode[] => {
  if (isReplicateHappyHorseVideoModel(model)) return ['text', 'image-to-video', 'reference-to-video']
  if (isReplicateSeedanceVideoModel(model)) return ['text', 'image-to-video', 'interpolate', 'reference-to-video', 'edit', 'extend']
  if (isReplicateKlingOmniVideoModel(model)) return ['text', 'image-to-video', 'interpolate', 'reference-to-video', 'edit']
  if (isReplicateKlingVideoModel(model) || isReplicatePixVerseVideoModel(model)) return ['text', 'image-to-video', 'interpolate']
  return ['text']
}

const hasReplicateSpecificOptions = (options: VideoGenOptions): boolean =>
  options.replicateVideoSeed !== undefined
  || hasValue(options.replicateVideoNegativePrompt)
  || hasValue(options.replicateVideoMultiPrompt)
  || options.replicateVideoMultiClip !== undefined

const rejectReplicateFlags = (
  model: ReplicateVideoModel,
  entries: Array<[boolean, string]>
): void => {
  const rejected = entries.filter(([condition]) => condition).map(([, flagName]) => flagName)
  if (rejected.length > 0) {
    throw CLIUsageError(`${rejected.join(', ')} ${rejected.length === 1 ? 'is' : 'are'} not supported by Replicate/${model}.`)
  }
}

const validateReplicateSeedanceReferences = (
  model: ReplicateVideoModel,
  options: VideoGenOptions
): void => {
  const referenceImageCount = options.videoReferenceImages?.length ?? 0
  const referenceVideoCount = (options.videoInputVideo ? 1 : 0) + (options.videoReferenceVideos?.length ?? 0)
  const referenceAudioCount = options.videoReferenceAudios?.length ?? 0
  if (referenceImageCount > 9) {
    throw CLIUsageError(`--video-reference-image supports at most 9 images for Replicate/${model}.`)
  }
  if (referenceVideoCount > 3) {
    throw CLIUsageError(`Replicate/${model} supports at most 3 reference videos including --video-input-video.`)
  }
  if (referenceAudioCount > 3) {
    throw CLIUsageError(`--video-reference-audio supports at most 3 audio references for Replicate/${model}.`)
  }
  if (referenceAudioCount > 0 && referenceImageCount === 0 && referenceVideoCount === 0) {
    throw CLIUsageError(`--video-reference-audio requires at least one --video-reference-image, --video-input-video, or --video-reference-video for Replicate/${model}.`)
  }
  if ((options.videoInputImage || options.videoLastFrame) && referenceImageCount > 0) {
    throw CLIUsageError(`--video-reference-image cannot be combined with --video-input-image or --video-last-frame for Replicate/${model}.`)
  }
}

export const collectReplicateVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.replicateVideoModels ?? []
  if (hasReplicateSpecificOptions(options) && models.length === 0) {
    throw CLIUsageError('Replicate video flags require a Replicate video provider target.')
  }

  return models.flatMap((rawModel) => {
    const model: ReplicateVideoModel = validateReplicateVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'replicate', model, mode, getReplicateSupportedVideoModes(model))) {
      return []
    }
    normalizeReplicateVideoDuration(model, options.videoDuration)
    normalizeReplicateVideoResolution(model, options.videoResolution)
    normalizeReplicateVideoAspectRatio(model, options.videoAspectRatio)

    if (isReplicateHappyHorseVideoModel(model)) {
      rejectReplicateFlags(model, [
        [options.videoGenerateAudio !== undefined, '--video-generate-audio'],
        [(options.videoReferenceVideos?.length ?? 0) > 0, '--video-reference-video'],
        [(options.videoReferenceAudios?.length ?? 0) > 0, '--video-reference-audio'],
        [hasValue(options.replicateVideoNegativePrompt), '--replicate-video-negative-prompt'],
        [hasValue(options.replicateVideoMultiPrompt), '--replicate-video-multi-prompt'],
        [options.replicateVideoMultiClip !== undefined, '--replicate-video-multi-clip']
      ])
      if ((options.videoReferenceImages?.length ?? 0) > 9) {
        throw CLIUsageError(`--video-reference-image supports at most 9 images for Replicate/${model}.`)
      }
    } else if (isReplicateSeedanceVideoModel(model)) {
      rejectReplicateFlags(model, [
        [hasValue(options.replicateVideoNegativePrompt), '--replicate-video-negative-prompt'],
        [hasValue(options.replicateVideoMultiPrompt), '--replicate-video-multi-prompt'],
        [options.replicateVideoMultiClip !== undefined, '--replicate-video-multi-clip']
      ])
      validateReplicateSeedanceReferences(model, options)
    } else if (isReplicateKlingVideoModel(model)) {
      rejectReplicateFlags(model, [
        [(options.videoReferenceAudios?.length ?? 0) > 0, '--video-reference-audio'],
        [!isReplicateKlingOmniVideoModel(model) && (options.videoReferenceVideos?.length ?? 0) > 0, '--video-reference-video'],
        [isReplicateKlingOmniVideoModel(model) && hasValue(options.replicateVideoNegativePrompt), '--replicate-video-negative-prompt'],
        [options.replicateVideoMultiClip !== undefined, '--replicate-video-multi-clip']
      ])
      if (isReplicateKlingOmniVideoModel(model) && (options.videoReferenceVideos?.length ?? 0) > 1) {
        throw CLIUsageError(`--video-reference-video supports at most 1 video for Replicate/${model}.`)
      }
      const hasOmniVideoReference = !!options.videoInputVideo || (options.videoReferenceVideos?.length ?? 0) > 0
      if (isReplicateKlingOmniVideoModel(model) && hasOmniVideoReference && options.videoGenerateAudio === true) {
        throw CLIUsageError(`--video-generate-audio cannot be combined with a video input or reference for Replicate/${model}.`)
      }
      if (isReplicateKlingOmniVideoModel(model) && hasOmniVideoReference && options.videoResolution === '4k') {
        throw CLIUsageError(`--video-resolution 4k cannot be combined with a video input or reference for Replicate/${model}.`)
      }
    } else if (isReplicatePixVerseVideoModel(model)) {
      rejectReplicateFlags(model, [
        [(options.videoReferenceVideos?.length ?? 0) > 0, '--video-reference-video'],
        [(options.videoReferenceAudios?.length ?? 0) > 0, '--video-reference-audio'],
        [hasValue(options.replicateVideoMultiPrompt), '--replicate-video-multi-prompt']
      ])
    }

    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'replicate', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--video-last-frame', provider: 'replicate', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      const maxInputs = isReplicateSeedanceVideoModel(model) || isReplicateHappyHorseVideoModel(model)
        ? 9
        : isReplicateKlingOmniVideoModel(model) ? 7 : 3
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'replicate', model, kind: 'image', maxInputs })
    }
    if (options.videoInputVideo) {
      validateVideoMediaReferences([options.videoInputVideo], { flagName: '--video-input-video', provider: 'replicate', model, kind: 'video' })
    }
    if (options.videoReferenceVideos) {
      validateVideoMediaReferences(options.videoReferenceVideos, { flagName: '--video-reference-video', provider: 'replicate', model, kind: 'video', maxInputs: 3 })
    }
    if (options.videoReferenceAudios) {
      validateVideoMediaReferences(options.videoReferenceAudios, { flagName: '--video-reference-audio', provider: 'replicate', model, kind: 'audio', maxInputs: 3 })
    }

    return [{
      service: 'replicate',
      model,
      run: async (prompt, outputDir) => {
        return await runReplicateVideoGen(prompt, outputDir, {
          model,
          mode,
          durationSeconds: options.videoDuration,
          aspectRatio: options.videoAspectRatio,
          resolution: options.videoResolution,
          inputImage: options.videoInputImage,
          lastFrameImage: options.videoLastFrame,
          referenceImages: options.videoReferenceImages,
          inputVideo: options.videoInputVideo,
          referenceVideos: options.videoReferenceVideos,
          referenceAudios: options.videoReferenceAudios,
          negativePrompt: options.replicateVideoNegativePrompt,
          generateAudio: options.videoGenerateAudio,
          seed: options.replicateVideoSeed,
          multiPrompt: options.replicateVideoMultiPrompt,
          multiClip: options.replicateVideoMultiClip
        })
      }
    }]
  })
}
