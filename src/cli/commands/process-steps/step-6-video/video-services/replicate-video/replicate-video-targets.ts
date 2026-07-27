import type { ReplicateVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateReplicateVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError } from '~/utils/error-handler'
import { runReplicateVideoGen } from './run-replicate-video-gen'
import { hasValue, isSupportedOrSkippedForAllVideo } from '../../video-utils/video-mode-validation'
import {
  isReplicateHappyHorseVideoModel,
  isReplicateSeedanceVideoModel,
  isReplicateWanVideoModel,
  normalizeReplicateVideoAspectRatio,
  normalizeReplicateVideoDuration,
  normalizeReplicateVideoResolution
} from '../../video-utils/video-normalization'
import { validateVideoMediaReferences } from '../../video-utils/video-media-inputs'

const getReplicateSupportedVideoModes = (model: ReplicateVideoModel): readonly VideoMode[] => {
  if (isReplicateHappyHorseVideoModel(model)) return ['text', 'image-to-video']
  if (isReplicateSeedanceVideoModel(model)) return ['text', 'image-to-video', 'interpolate', 'reference-to-video', 'edit', 'extend']
  return ['text']
}

export const hasReplicateSpecificOptions = (options: VideoGenOptions): boolean =>
  options.replicateVideoSeed !== undefined
  || options.replicateVideoGenerateAudio !== undefined
  || (options.replicateVideoReferenceVideos?.length ?? 0) > 0
  || (options.replicateVideoReferenceAudios?.length ?? 0) > 0
  || hasValue(options.replicateVideoNegativePrompt)
  || hasValue(options.replicateVideoAudio)
  || options.replicateVideoPromptExpansion !== undefined

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
  const referenceVideoCount = (options.videoInputVideo ? 1 : 0) + (options.replicateVideoReferenceVideos?.length ?? 0)
  const referenceAudioCount = options.replicateVideoReferenceAudios?.length ?? 0
  if (referenceImageCount > 9) {
    throw CLIUsageError(`--video-reference-image supports at most 9 images for Replicate/${model}.`)
  }
  if (referenceVideoCount > 3) {
    throw CLIUsageError(`Replicate/${model} supports at most 3 reference videos including --video-input-video.`)
  }
  if (referenceAudioCount > 3) {
    throw CLIUsageError(`--replicate-video-reference-audio supports at most 3 audio references for Replicate/${model}.`)
  }
  if (referenceAudioCount > 0 && referenceImageCount === 0 && referenceVideoCount === 0) {
    throw CLIUsageError(`--replicate-video-reference-audio requires at least one --video-reference-image, --video-input-video, or --replicate-video-reference-video for Replicate/${model}.`)
  }
  if ((options.videoInputImage || options.videoLastFrame) && referenceImageCount > 0) {
    throw CLIUsageError(`--video-reference-image cannot be combined with --video-input-image or --video-last-frame for Replicate/${model}.`)
  }
}

export const collectReplicateVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.replicateVideoModels ?? (options.replicateVideoModel ? [options.replicateVideoModel] : [])
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
        [options.replicateVideoGenerateAudio !== undefined, '--replicate-video-generate-audio'],
        [(options.replicateVideoReferenceVideos?.length ?? 0) > 0, '--replicate-video-reference-video'],
        [(options.replicateVideoReferenceAudios?.length ?? 0) > 0, '--replicate-video-reference-audio'],
        [hasValue(options.replicateVideoNegativePrompt), '--replicate-video-negative-prompt'],
        [hasValue(options.replicateVideoAudio), '--replicate-video-audio'],
        [options.replicateVideoPromptExpansion !== undefined, '--replicate-video-prompt-expansion']
      ])
    } else if (isReplicateSeedanceVideoModel(model)) {
      rejectReplicateFlags(model, [
        [hasValue(options.replicateVideoNegativePrompt), '--replicate-video-negative-prompt'],
        [hasValue(options.replicateVideoAudio), '--replicate-video-audio'],
        [options.replicateVideoPromptExpansion !== undefined, '--replicate-video-prompt-expansion']
      ])
      validateReplicateSeedanceReferences(model, options)
    } else if (isReplicateWanVideoModel(model)) {
      rejectReplicateFlags(model, [
        [options.replicateVideoGenerateAudio !== undefined, '--replicate-video-generate-audio'],
        [(options.replicateVideoReferenceVideos?.length ?? 0) > 0, '--replicate-video-reference-video'],
        [(options.replicateVideoReferenceAudios?.length ?? 0) > 0, '--replicate-video-reference-audio']
      ])
    }

    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'replicate', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--video-last-frame', provider: 'replicate', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'replicate', model, kind: 'image', maxInputs: isReplicateSeedanceVideoModel(model) ? 9 : 3 })
    }
    if (options.videoInputVideo) {
      validateVideoMediaReferences([options.videoInputVideo], { flagName: '--video-input-video', provider: 'replicate', model, kind: 'video' })
    }
    if (options.replicateVideoReferenceVideos) {
      validateVideoMediaReferences(options.replicateVideoReferenceVideos, { flagName: '--replicate-video-reference-video', provider: 'replicate', model, kind: 'video', maxInputs: 3 })
    }
    if (options.replicateVideoReferenceAudios) {
      validateVideoMediaReferences(options.replicateVideoReferenceAudios, { flagName: '--replicate-video-reference-audio', provider: 'replicate', model, kind: 'audio', maxInputs: 3 })
    }
    if (options.replicateVideoAudio) {
      validateVideoMediaReferences([options.replicateVideoAudio], { flagName: '--replicate-video-audio', provider: 'replicate', model, kind: 'audio' })
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
          referenceVideos: options.replicateVideoReferenceVideos,
          referenceAudios: options.replicateVideoReferenceAudios,
          negativePrompt: options.replicateVideoNegativePrompt,
          audio: options.replicateVideoAudio,
          promptExpansion: options.replicateVideoPromptExpansion,
          generateAudio: options.replicateVideoGenerateAudio,
          seed: options.replicateVideoSeed
        })
      }
    }]
  })
}
