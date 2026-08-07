import type { VideoGenOptions, VideoMode } from '~/types'
import { VIDEO_MODES } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const resolveVideoMode = (value: string | undefined): VideoMode => {
  if (value === undefined || value.length === 0) return 'text'
  if ((VIDEO_MODES as readonly string[]).includes(value)) return value as VideoMode
  throw CLIUsageError(`Invalid --video-mode value "${value}". Expected text, image-to-video, reference-to-video, interpolate, extend, or edit.`)
}

export const hasValue = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : value !== undefined && value !== ''

export const validateModeInputs = (options: VideoGenOptions, mode: VideoMode): void => {
  const referenceImages = options.videoReferenceImages ?? []
  const replicateReferenceVideos = options.replicateVideoReferenceVideos ?? []
  const replicateReferenceAudios = options.replicateVideoReferenceAudios ?? []
  const falReferenceVideos = options.falVideoReferenceVideos ?? []
  const falReferenceAudios = options.falVideoReferenceAudios ?? []

  const unexpected: string[] = []
  const addUnexpected = (condition: boolean, flagName: string): void => {
    if (condition) unexpected.push(flagName)
  }

  if (mode === 'text') {
    addUnexpected(hasValue(options.videoInputImage), '--video-input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--video-last-frame')
    addUnexpected(referenceImages.length > 0, '--video-reference-image')
    addUnexpected(hasValue(options.videoInputVideo), '--video-input-video')
  } else if (mode === 'image-to-video') {
    if (!options.videoInputImage) throw CLIUsageError('--video-mode image-to-video requires --video-input-image.')
    addUnexpected(hasValue(options.videoLastFrame), '--video-last-frame')
    addUnexpected(referenceImages.length > 0, '--video-reference-image')
    addUnexpected(hasValue(options.videoInputVideo), '--video-input-video')
  } else if (mode === 'reference-to-video') {
    if (referenceImages.length === 0 && replicateReferenceVideos.length === 0 && replicateReferenceAudios.length === 0 && falReferenceVideos.length === 0 && falReferenceAudios.length === 0) {
      throw CLIUsageError('--video-mode reference-to-video requires at least one image, video, or audio reference.')
    }
    addUnexpected(hasValue(options.videoInputImage), '--video-input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--video-last-frame')
    addUnexpected(hasValue(options.videoInputVideo), '--video-input-video')
  } else if (mode === 'interpolate') {
    if (!options.videoInputImage) throw CLIUsageError('--video-mode interpolate requires --video-input-image.')
    if (!options.videoLastFrame) throw CLIUsageError('--video-mode interpolate requires --video-last-frame.')
    addUnexpected(referenceImages.length > 0, '--video-reference-image')
    addUnexpected(hasValue(options.videoInputVideo), '--video-input-video')
  } else if (mode === 'extend') {
    if (!options.videoInputVideo) throw CLIUsageError('--video-mode extend requires --video-input-video.')
    addUnexpected(hasValue(options.videoInputImage), '--video-input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--video-last-frame')
    addUnexpected(referenceImages.length > 0, '--video-reference-image')
  } else if (mode === 'edit') {
    if (!options.videoInputVideo) throw CLIUsageError('--video-mode edit requires --video-input-video.')
    addUnexpected(hasValue(options.videoInputImage), '--video-input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--video-last-frame')
    addUnexpected(referenceImages.length > 0, '--video-reference-image')
  }

  if (unexpected.length > 0) {
    throw CLIUsageError(`${unexpected.join(', ')} ${unexpected.length === 1 ? 'is' : 'are'} not valid with --video-mode ${mode}.`)
  }
}

export const rejectUnsupportedMode = (
  provider: string,
  model: string,
  mode: VideoMode,
  supportedModes: readonly VideoMode[]
): void => {
  if (!supportedModes.includes(mode)) {
    throw CLIUsageError(`--video-mode ${mode} is not supported by ${provider}/${model}.`)
  }
}

export const isSupportedOrSkippedForAllVideo = (
  options: VideoGenOptions,
  provider: string,
  model: string,
  mode: VideoMode,
  supportedModes: readonly VideoMode[]
): boolean => {
  if (supportedModes.includes(mode)) return true
  if (options.allVideo) return false
  rejectUnsupportedMode(provider, model, mode, supportedModes)
  return false
}

export const requireReferenceImagesForProvider = (
  options: VideoGenOptions,
  provider: string,
  model: string
): void => {
  if ((options.videoReferenceImages?.length ?? 0) === 0) {
    throw CLIUsageError(`--video-mode reference-to-video requires at least one --video-reference-image for ${provider}/${model}.`)
  }
}
