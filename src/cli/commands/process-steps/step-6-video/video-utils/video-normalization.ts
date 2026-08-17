import type { GeminiDurationSeconds, GeminiResolution, GrokVideoDurationSeconds, GrokVideoResolution, LtxVideoDurationSeconds, LtxVideoModel, LumaVideoDuration, LumaVideoResolution, ReplicateVideoModel, ReplicateVideoResolution, VideoMode } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const REPLICATE_COMMON_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const
export const REPLICATE_SEEDANCE_ASPECT_RATIOS = [...REPLICATE_COMMON_ASPECT_RATIOS, '21:9', '9:21', 'adaptive'] as const

export const isReplicateSeedanceVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'bytedance/seedance-2.0' || model === 'bytedance/seedance-2.0-fast'

const clampIntegerDuration = (
  duration: number | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string
): number => {
  if (duration === undefined) return fallback
  if (!Number.isFinite(duration) || !Number.isInteger(duration) || duration < min || duration > max) {
    throw CLIUsageError(`Invalid --video-duration value "${String(duration)}" for ${label}. Expected an integer from ${min} to ${max}.`)
  }
  return duration
}

const normalizeReplicateAspectRatioFrom = (
  aspectRatio: string | undefined,
  allowed: readonly string[],
  label: string
): string => {
  if (aspectRatio === undefined || aspectRatio === '') return '16:9'
  if (allowed.includes(aspectRatio)) return aspectRatio
  throw CLIUsageError(`Invalid --video-aspect-ratio value "${aspectRatio}" for ${label}. Expected ${allowed.join(', ')}.`)
}

export const isReplicateHappyHorseVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'alibaba/happyhorse-1.1'

export const isReplicateKlingVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'kwaivgi/kling-v3-video' || model === 'kwaivgi/kling-v3-omni-video'

export const isReplicateKlingOmniVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'kwaivgi/kling-v3-omni-video'

export const isReplicatePixVerseVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'pixverse/pixverse-v6'

export const isReplicateSeedanceFastVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'bytedance/seedance-2.0-fast'

export const REPLICATE_HAPPYHORSE_DURATION_RANGE = [3, 15] as const
export const REPLICATE_SEEDANCE_DURATION_RANGE = [-1, 15] as const

export const normalizeReplicateVideoDuration = (
  model: ReplicateVideoModel,
  duration: number | undefined
): number => {
  if (isReplicateHappyHorseVideoModel(model)) {
    return clampIntegerDuration(duration, 5, ...REPLICATE_HAPPYHORSE_DURATION_RANGE, `Replicate/${model}`)
  }
  if (isReplicateSeedanceVideoModel(model)) {
    return clampIntegerDuration(duration, 5, ...REPLICATE_SEEDANCE_DURATION_RANGE, `Replicate/${model}`)
  }
  if (isReplicateKlingVideoModel(model)) {
    return clampIntegerDuration(duration, 5, 3, 15, `Replicate/${model}`)
  }
  if (isReplicatePixVerseVideoModel(model)) {
    const value = duration ?? 5
    if (value === 5 || value === 8 || value === 10 || value === 15) return value
    throw CLIUsageError(`Invalid --video-duration value "${String(duration)}" for Replicate/${model}. Expected 5, 8, 10, or 15.`)
  }
  return clampIntegerDuration(duration, 5, 3, 15, `Replicate/${model}`)
}

export const resolveReplicateBilledDuration = (
  model: ReplicateVideoModel,
  duration: number | undefined
): number => {
  const normalized = normalizeReplicateVideoDuration(model, duration)
  return normalized === -1 ? 5 : normalized
}

export const REPLICATE_VIDEO_RESOLUTIONS = ['360p', '480p', '540p', '720p', '1080p', '4k'] as const

export const normalizeReplicateVideoResolution = (
  model: ReplicateVideoModel,
  resolution: string | undefined
): ReplicateVideoResolution => {
  if (resolution === undefined || resolution === '') return '720p'
  if (isReplicateKlingVideoModel(model)) {
    if (resolution === '720p' || resolution === '1080p' || resolution === '4k') return resolution
    throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Replicate/${model}. Expected 720p, 1080p, or 4k.`)
  }
  if (isReplicatePixVerseVideoModel(model)) {
    if (resolution === '360p' || resolution === '540p' || resolution === '720p' || resolution === '1080p') return resolution
    throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Replicate/${model}. Expected 360p, 540p, 720p, or 1080p.`)
  }
  if (isReplicateHappyHorseVideoModel(model)) {
    if (resolution === '720p' || resolution === '1080p') return resolution
    throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Replicate/${model}. Expected 720p or 1080p.`)
  }
  if (isReplicateSeedanceFastVideoModel(model)) {
    if (resolution === '480p' || resolution === '720p') return resolution
    throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Replicate/${model}. Expected 480p or 720p.`)
  }
  if (resolution === '480p' || resolution === '720p' || resolution === '1080p') return resolution
  throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Replicate/${model}. Expected ${REPLICATE_VIDEO_RESOLUTIONS.join(', ')}.`)
}

export const normalizeReplicateVideoAspectRatio = (
  model: ReplicateVideoModel,
  aspectRatio: string | undefined
): string => {
  if (isReplicateSeedanceVideoModel(model)) {
    return normalizeReplicateAspectRatioFrom(aspectRatio, REPLICATE_SEEDANCE_ASPECT_RATIOS, `Replicate/${model}`)
  }
  if (isReplicateKlingVideoModel(model) || isReplicatePixVerseVideoModel(model)) {
    return normalizeReplicateAspectRatioFrom(aspectRatio, ['16:9', '9:16', '1:1'], `Replicate/${model}`)
  }
  return normalizeReplicateAspectRatioFrom(aspectRatio, REPLICATE_COMMON_ASPECT_RATIOS, `Replicate/${model}`)
}

export const GEMINI_DURATION_SECONDS = [4, 6, 8] as const

export const normalizeGeminiDuration = (
  duration: number | undefined,
  resolution?: GeminiResolution | string | undefined,
  mode?: VideoMode | undefined
): GeminiDurationSeconds => {
  const [shortest, middle, longest] = GEMINI_DURATION_SECONDS
  if (resolution === '1080p' || resolution === '4k' || mode === 'reference-to-video' || mode === 'extend') return longest
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return shortest
  const n = Math.floor(duration)
  if (n <= shortest) return shortest
  if (n <= middle) return middle
  return longest
}

export const GEMINI_VIDEO_RESOLUTIONS = ['720p', '1080p', '4k'] as const

export const normalizeGeminiResolution = (
  resolution: string | undefined,
  model?: string | undefined
): GeminiResolution => {
  if (resolution === undefined || resolution === '') return '720p'
  if (resolution !== '720p' && resolution !== '1080p' && resolution !== '4k') {
    throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Gemini. Expected ${GEMINI_VIDEO_RESOLUTIONS.join(', ')}.`)
  }
  if (resolution === '4k' && model === 'veo-3.1-lite-generate-preview') {
    throw CLIUsageError('Gemini Veo 3.1 Lite does not support --video-resolution 4k. Use veo-3.1-generate-preview or veo-3.1-fast-generate-preview for 4k.')
  }
  if (resolution === '4k') return '4k'
  if (resolution === '1080p') return '1080p'
  return '720p'
}

export const GROK_VIDEO_DURATION_RANGE = [1, 15] as const

export const normalizeGrokVideoDuration = (duration: number | undefined): GrokVideoDurationSeconds => {
  const [min, max] = GROK_VIDEO_DURATION_RANGE
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 8
  return Math.min(max, Math.max(min, Math.floor(duration))) as GrokVideoDurationSeconds
}

export const normalizeGrokVideoExtensionDuration = (duration: number | undefined): number => {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 6
  return Math.min(10, Math.max(1, Math.floor(duration)))
}

export const GROK_VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'] as const

export const normalizeGrokVideoResolution = (resolution: string | undefined, model?: string | undefined): GrokVideoResolution => {
  if (resolution === undefined || resolution === '') return '480p'
  if (resolution === '480p' || resolution === '720p') return resolution
  if (resolution === '1080p' && model === 'grok-imagine-video-1.5') return resolution
  throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Grok/${model ?? 'video'}. Expected ${model === 'grok-imagine-video-1.5' ? GROK_VIDEO_RESOLUTIONS.join(', ') : '480p or 720p'}.`)
}

export const GROK_VIDEO_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const

export const normalizeGrokVideoAspectRatio = (aspectRatio: string | undefined): string => {
  const allowed = new Set<string>(GROK_VIDEO_ASPECT_RATIOS)
  return aspectRatio && allowed.has(aspectRatio) ? aspectRatio : '16:9'
}

const isLtxFastModel = (model: LtxVideoModel): boolean => model.endsWith('-fast')

export const normalizeLtxVideoResolution = (resolution: string | undefined): '1080p' | '4k' => {
  if (resolution === undefined || resolution === '') return '1080p'
  if (resolution === '1080p' || resolution === '4k') return resolution
  throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for LTX. Expected ${LTX_RESOLUTIONS.join(' or ')}.`)
}

export const normalizeLtxVideoAspectRatio = (model: LtxVideoModel, aspectRatio: string | undefined): '16:9' | '9:16' => {
  if (aspectRatio === undefined || aspectRatio === '') return '16:9'
  if (aspectRatio === '16:9') return '16:9'
  if (aspectRatio === '9:16') return '9:16'
  throw CLIUsageError(`Invalid --video-aspect-ratio value "${aspectRatio}" for LTX ${model}. Expected ${LTX_ASPECT_RATIOS.join(' or ')}.`)
}

export const normalizeLtxVideoSize = (
  model: LtxVideoModel,
  resolution: string | undefined,
  aspectRatio: string | undefined
): string => {
  const normalizedResolution = normalizeLtxVideoResolution(resolution)
  const normalizedAspectRatio = normalizeLtxVideoAspectRatio(model, aspectRatio)
  if (normalizedResolution === '4k') return normalizedAspectRatio === '9:16' ? '2160x3840' : '3840x2160'
  return normalizedAspectRatio === '9:16' ? '1080x1920' : '1920x1080'
}

export const LUMA_RESOLUTIONS = ['540p', '720p', '1080p'] as const
export const LUMA_ASPECT_RATIOS = ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9'] as const

export const LUMA_DURATION_SECONDS = [5, 10] as const

export const normalizeLumaVideoDuration = (duration: number | undefined): LumaVideoDuration => {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return '5s'
  return Math.floor(duration) >= 8 ? '10s' : '5s'
}

export const normalizeLumaVideoResolution = (resolution: string | undefined): LumaVideoResolution => {
  if (resolution === undefined || resolution === '') return '720p'
  if ((LUMA_RESOLUTIONS as readonly string[]).includes(resolution)) return resolution as LumaVideoResolution
  throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Luma Labs. Expected ${LUMA_RESOLUTIONS.join(', ')}.`)
}

export const normalizeLumaVideoAspectRatio = (aspectRatio: string | undefined): string => {
  if (aspectRatio === undefined || aspectRatio === '') return '16:9'
  if ((LUMA_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) return aspectRatio
  throw CLIUsageError(`Invalid --video-aspect-ratio value "${aspectRatio}" for Luma Labs. Expected ${LUMA_ASPECT_RATIOS.join(', ')}.`)
}

export const LTX_DURATION_SECONDS = [6, 8, 10] as const
export const LTX_FAST_1080P_DURATION_SECONDS = [6, 8, 10, 12, 14, 16, 18, 20] as const
export const LTX_EXTEND_DURATION_RANGE = [2, 20] as const
export const LTX_RESOLUTIONS = ['1080p', '4k'] as const
export const LTX_ASPECT_RATIOS = ['16:9', '9:16'] as const

export const normalizeLtxVideoDuration = (
  model: LtxVideoModel,
  size: string,
  duration: number | undefined,
  mode?: string | undefined
): LtxVideoDurationSeconds => {
  if (mode === 'extend') {
    const [min, max] = LTX_EXTEND_DURATION_RANGE
    if (typeof duration !== 'number' || !Number.isFinite(duration)) return 8
    return Math.min(max, Math.max(min, Math.floor(duration))) as LtxVideoDurationSeconds
  }

  const requested = typeof duration === 'number' && Number.isFinite(duration) ? Math.floor(duration) : 8
  const allowed = isLtxFastModel(model) && size === '1920x1080'
    ? LTX_FAST_1080P_DURATION_SECONDS
    : LTX_DURATION_SECONDS

  let best = allowed[0] as number
  for (const candidate of allowed) {
    if (Math.abs(candidate - requested) < Math.abs(best - requested)) {
      best = candidate
    }
  }
  return best as LtxVideoDurationSeconds
}
