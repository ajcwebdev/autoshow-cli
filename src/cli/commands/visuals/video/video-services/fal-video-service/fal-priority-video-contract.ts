import type { EstimateVideoCostOptions, FalVideoModel, VideoMode } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { getVideoModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader'

export const isFalSeedance25 = (model: string): boolean => model.startsWith('bytedance/seedance-2.5/')
export const isFalH3Max = (model: string): boolean => model.startsWith('minimax/h3-max/') || model.startsWith('minimax/h3-max-turbo/')
export const isFalPriorityVideo = (model: string): boolean => isFalSeedance25(model) || isFalH3Max(model)

export const falPriorityModes = (model: string): readonly VideoMode[] => model.endsWith('/text-to-video') ? ['text'] : model.endsWith('/image-to-video') ? ['image-to-video', 'interpolate'] : ['reference-to-video']

export const normalizeFalPriorityDuration = (model: string, value?: number): number => {
  const duration = value ?? 5
  if (isFalSeedance25(model) && duration === -1) return -1
  const min = isFalSeedance25(model) ? 4 : 5
  const max = isFalSeedance25(model) ? 30 : 15
  if (!Number.isInteger(duration) || duration < min || duration > max) throw UsageError(`fal/${model} duration must be ${min}–${max} seconds${isFalSeedance25(model) ? ' or -1 for automatic duration' : ''}.`)
  return duration
}

export const normalizeFalPriorityResolution = (model: string, value?: string): string => {
  const resolution = value?.toLowerCase() ?? (isFalSeedance25(model) ? '720p' : '768p')
  const allowed = isFalSeedance25(model) ? ['480p', '720p', '1080p'] : ['480p', '768p', '1080p']
  if (!allowed.includes(resolution)) throw UsageError(`fal/${model} resolution must be ${allowed.join(', ')}.`)
  return isFalSeedance25(model) ? resolution : resolution.toUpperCase()
}

export const normalizeFalPriorityAspectRatio = (model: string, value: string | undefined, mode: VideoMode): string | undefined => {
  if (mode === 'image-to-video' || mode === 'interpolate') {
    if (value !== undefined && (!isFalSeedance25(model) || value !== 'auto')) throw UsageError(`fal/${model} output follows the input frame; omit --aspect-ratio.`)
    return isFalSeedance25(model) ? 'auto' : undefined
  }
  const aspect = value ?? '16:9'
  if (!['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', ...(isFalSeedance25(model) ? ['auto'] : [])].includes(aspect)) throw UsageError(`Unsupported aspect ratio ${aspect} for fal/${model}.`)
  return aspect
}

export const validateFalPriorityInputs = (options: {
  model: string, mode: VideoMode, inputImage?: string | undefined, lastFrame?: string | undefined,
  referenceImages?: string[] | undefined, referenceVideos?: string[] | undefined, referenceAudios?: string[] | undefined,
  generateAudio?: boolean | undefined
}): void => {
  if (!falPriorityModes(options.model).includes(options.mode)) throw UsageError(`fal/${options.model} does not support --mode ${options.mode}. Select the matching route.`)
  const images = options.referenceImages?.length ?? 0
  const videos = options.referenceVideos?.length ?? 0
  const audios = options.referenceAudios?.length ?? 0
  if (isFalH3Max(options.model) && options.generateAudio !== undefined) throw UsageError('H3 Max native audio is not configurable; omit --generate-audio.')
  if (images > 30 || videos > 10 || audios > 10) throw UsageError('fal Seedance 2.5 accepts at most 30 images, 10 videos, and 10 audios.')
  if (options.mode === 'reference-to-video') {
    if (!images && !videos) throw UsageError('Seedance reference-to-video requires an image or video reference.')
    if (options.inputImage || options.lastFrame) throw UsageError('Reference media cannot be combined with first/last frame inputs.')
  } else if (images + videos + audios > 0) throw UsageError('This fal route does not accept reference media.')
  if (options.mode === 'text' && (options.inputImage || options.lastFrame)) throw UsageError('Select the image-to-video route for frame inputs.')
  if ((options.mode === 'image-to-video' || options.mode === 'interpolate') && !options.inputImage) throw UsageError('This fal image route requires --input-image.')
  if (options.mode === 'interpolate' && !options.lastFrame) throw UsageError('Interpolation requires --last-frame.')
}

export const estimateFalPriorityCost = (model: FalVideoModel, options: EstimateVideoCostOptions) => {
  const requested = normalizeFalPriorityDuration(model, options.videoDuration)
  const durationSeconds = requested === -1 ? 30 : requested
  const resolution = normalizeFalPriorityResolution(model, options.videoResolution).toLowerCase()
  const rate = getVideoModelMeta('fal', model)?.costPerSecondByResolutionCents?.[resolution]
  if (rate === undefined) throw UsageError(`Pricing is unknown for fal/${model} at ${resolution}.`)
  const seedance = isFalSeedance25(model)
  const hasVideo = (options.falVideoReferenceVideoCount ?? 0) > 0
  const inputDuration = seedance && hasVideo ? options.falInputVideoDurationSeconds ?? 30.2 : 0
  if (!Number.isFinite(inputDuration) || inputDuration < 0 || inputDuration > 30.2) throw UsageError('fal Seedance reference videos must total at most 30.2 seconds.')
  const costPerSecond = rate * (seedance && hasVideo ? 0.6 : 1)
  return {
    provider: 'fal' as const, model, durationSeconds,
    billedDurationSeconds: durationSeconds + inputDuration,
    costPerSecond,
    totalCost: (durationSeconds + inputDuration) * costPerSecond,
    note: seedance
      ? 'Approximate token-based cost using published 16:9 per-second equivalents; actual output dimensions affect billing. Automatic output duration budgets 30s; unknown reference-video duration budgets 30.2s. Input and output seconds are included and video-input discount is applied.'
      : 'Conservative regular per-second rate, including before the September 15, 2026 promotion cutoff.'
  }
}
