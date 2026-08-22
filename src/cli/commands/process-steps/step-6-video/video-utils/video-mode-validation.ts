import type { VideoGenOptions, VideoMode } from '~/types'
import { VIDEO_MODES } from '~/types'
import { UsageError } from '~/utils/error-handler'

export const resolveVideoMode = (value: string | undefined): VideoMode => {
  if (value === undefined || value.length === 0) return 'text'
  if ((VIDEO_MODES as readonly string[]).includes(value)) return value as VideoMode
  throw UsageError(`Invalid --mode value "${value}". Expected text, image-to-video, reference-to-video, interpolate, extend, or edit.`)
}

export const hasValue = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : value !== undefined && value !== ''

export const validateModeInputs = (options: VideoGenOptions, mode: VideoMode): void => {
  const referenceImages = options.videoReferenceImages ?? []
  const referenceVideos = options.videoReferenceVideos ?? []
  const referenceAudios = options.videoReferenceAudios ?? []

  const unexpected: string[] = []
  const addUnexpected = (condition: boolean, flagName: string): void => {
    if (condition) unexpected.push(flagName)
  }

  if (mode === 'text') {
    addUnexpected(hasValue(options.videoInputImage), '--input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--last-frame')
    addUnexpected(referenceImages.length > 0, '--reference-image')
    addUnexpected(hasValue(options.videoInputVideo), '--input-video')
    addUnexpected(referenceVideos.length > 0, '--reference-video')
    addUnexpected(referenceAudios.length > 0, '--reference-audio')
  } else if (mode === 'image-to-video') {
    if (!options.videoInputImage) throw UsageError('--mode image-to-video requires --input-image.')
    addUnexpected(hasValue(options.videoLastFrame), '--last-frame')
    addUnexpected(referenceImages.length > 0, '--reference-image')
    addUnexpected(hasValue(options.videoInputVideo), '--input-video')
    addUnexpected(referenceVideos.length > 0, '--reference-video')
    addUnexpected(referenceAudios.length > 0, '--reference-audio')
  } else if (mode === 'reference-to-video') {
    if (referenceImages.length === 0 && referenceVideos.length === 0 && referenceAudios.length === 0) {
      throw UsageError('--mode reference-to-video requires at least one image, video, or audio reference.')
    }
    addUnexpected(hasValue(options.videoInputImage), '--input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--last-frame')
    addUnexpected(hasValue(options.videoInputVideo), '--input-video')
  } else if (mode === 'interpolate') {
    if (!options.videoInputImage) throw UsageError('--mode interpolate requires --input-image.')
    if (!options.videoLastFrame) throw UsageError('--mode interpolate requires --last-frame.')
    addUnexpected(referenceImages.length > 0, '--reference-image')
    addUnexpected(hasValue(options.videoInputVideo), '--input-video')
    addUnexpected(referenceVideos.length > 0, '--reference-video')
    addUnexpected(referenceAudios.length > 0, '--reference-audio')
  } else if (mode === 'extend') {
    if (!options.videoInputVideo) throw UsageError('--mode extend requires --input-video.')
    addUnexpected(hasValue(options.videoInputImage), '--input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--last-frame')
    addUnexpected(referenceImages.length > 0, '--reference-image')
    addUnexpected(referenceVideos.length > 0, '--reference-video')
    addUnexpected(referenceAudios.length > 0, '--reference-audio')
  } else if (mode === 'edit') {
    if (!options.videoInputVideo) throw UsageError('--mode edit requires --input-video.')
    addUnexpected(hasValue(options.videoInputImage), '--input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--last-frame')
    addUnexpected(referenceImages.length > 0, '--reference-image')
    addUnexpected(referenceVideos.length > 0, '--reference-video')
    addUnexpected(referenceAudios.length > 0, '--reference-audio')
  }

  if (unexpected.length > 0) {
    throw UsageError(`${unexpected.join(', ')} ${unexpected.length === 1 ? 'is' : 'are'} not valid with --mode ${mode}.`)
  }
}

const rejectUnsupportedMode = (
  provider: string,
  model: string,
  mode: VideoMode,
  supportedModes: readonly VideoMode[]
): void => {
  if (!supportedModes.includes(mode)) {
    throw UsageError(`--mode ${mode} is not supported by ${provider}/${model}.`)
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
    throw UsageError(`--mode reference-to-video requires at least one --reference-image for ${provider}/${model}.`)
  }
}
