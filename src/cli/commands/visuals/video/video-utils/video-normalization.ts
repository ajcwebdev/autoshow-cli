import type { GeminiDurationSeconds, GeminiResolution, GrokVideoDurationSeconds, GrokVideoResolution, LtxVideoDurationSeconds, LtxVideoModel, LumaVideoDuration, LumaVideoResolution, ReplicateVideoModel, ReplicateVideoResolution, VideoMode } from '~/types'
import { UsageError } from '~/utils/error-handler'

export const REPLICATE_COMMON_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const
export const REPLICATE_SEEDANCE_ASPECT_RATIOS = [...REPLICATE_COMMON_ASPECT_RATIOS, '21:9', '9:21', 'adaptive'] as const

export const isReplicateSeedanceVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'bytedance/seedance-2.5'

const clampIntegerDuration = (
  duration: number | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string
): number => {
  if (duration === undefined) return fallback
  if (!Number.isFinite(duration) || !Number.isInteger(duration) || duration < min || duration > max) {
    throw UsageError(`Invalid --duration value "${String(duration)}" for ${label}. Expected an integer from ${min} to ${max}.`)
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
  throw UsageError(`Invalid --aspect-ratio value "${aspectRatio}" for ${label}. Expected ${allowed.join(', ')}.`)
}

export const isReplicateHappyHorseVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'alibaba/happyhorse-1.1'

export const isReplicateWanVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'alibaba/wan-3'

export const isReplicatePixVerseVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'pixverse/pixverse-v6'

export const REPLICATE_HAPPYHORSE_DURATION_RANGE = [3, 15] as const
export const REPLICATE_SEEDANCE_DURATION_RANGE = [4, 30] as const
export const REPLICATE_WAN_DURATION_RANGE = [2, 30] as const
export const REPLICATE_WAN_ASPECT_RATIOS = ['adaptive', ...REPLICATE_COMMON_ASPECT_RATIOS] as const

export const normalizeReplicateVideoDuration = (
  model: ReplicateVideoModel,
  duration: number | undefined
): number => {
  if (isReplicateSeedanceVideoModel(model)) {
    if (duration === -1) return -1
    return clampIntegerDuration(duration, 5, ...REPLICATE_SEEDANCE_DURATION_RANGE, `Replicate/${model}`)
  }
  if (isReplicateHappyHorseVideoModel(model)) {
    return clampIntegerDuration(duration, 5, ...REPLICATE_HAPPYHORSE_DURATION_RANGE, `Replicate/${model}`)
  }
  if (isReplicateWanVideoModel(model)) {
    return clampIntegerDuration(duration, 5, ...REPLICATE_WAN_DURATION_RANGE, `Replicate/${model}`)
  }
  if (isReplicatePixVerseVideoModel(model)) {
    const value = duration ?? 5
    if (value === 5 || value === 8 || value === 10 || value === 15) return value
    throw UsageError(`Invalid --duration value "${String(duration)}" for Replicate/${model}. Expected 5, 8, 10, or 15.`)
  }
  throw UsageError(`Unsupported Replicate video model: ${model}`)
}

export const resolveReplicateBilledDuration = (
  model: ReplicateVideoModel,
  duration: number | undefined
): number => {
  const normalized = normalizeReplicateVideoDuration(model, duration)
  return normalized === -1 ? 30 : normalized
}

export const REPLICATE_VIDEO_RESOLUTIONS = ['360p', '480p', '540p', '720p', '1080p'] as const

export const normalizeReplicateVideoResolution = (
  model: ReplicateVideoModel,
  resolution: string | undefined
): ReplicateVideoResolution => {
  if (resolution === undefined || resolution === '') return '720p'
  if (isReplicateSeedanceVideoModel(model)) {
    if (resolution === '480p' || resolution === '720p') return resolution
    throw UsageError(`Replicate/${model} supports 480p or 720p.`)
  }
  if (isReplicateWanVideoModel(model)) {
    if (resolution === '480p' || resolution === '720p' || resolution === '1080p') return resolution
    throw UsageError(`Invalid --resolution value "${resolution}" for Replicate/${model}. Expected 480p, 720p, or 1080p.`)
  }
  if (isReplicatePixVerseVideoModel(model)) {
    if (resolution === '360p' || resolution === '540p' || resolution === '720p' || resolution === '1080p') return resolution
    throw UsageError(`Invalid --resolution value "${resolution}" for Replicate/${model}. Expected 360p, 540p, 720p, or 1080p.`)
  }
  if (isReplicateHappyHorseVideoModel(model)) {
    if (resolution === '720p' || resolution === '1080p') return resolution
    throw UsageError(`Invalid --resolution value "${resolution}" for Replicate/${model}. Expected 720p or 1080p.`)
  }
  throw UsageError(`Invalid --resolution value "${resolution}" for Replicate/${model}. Expected ${REPLICATE_VIDEO_RESOLUTIONS.join(', ')}.`)
}

export const normalizeReplicateVideoAspectRatio = (
  model: ReplicateVideoModel,
  aspectRatio: string | undefined
): string => {
  if (isReplicateSeedanceVideoModel(model) && aspectRatio === '9:21') throw UsageError('Replicate Seedance 2.5 does not support 9:21.')
  if (isReplicateSeedanceVideoModel(model)) {
    return normalizeReplicateAspectRatioFrom(aspectRatio, REPLICATE_SEEDANCE_ASPECT_RATIOS, `Replicate/${model}`)
  }
  if (isReplicateWanVideoModel(model)) {
    return normalizeReplicateAspectRatioFrom(aspectRatio, REPLICATE_WAN_ASPECT_RATIOS, `Replicate/${model}`)
  }
  if (isReplicatePixVerseVideoModel(model)) {
    return normalizeReplicateAspectRatioFrom(aspectRatio, ['16:9', '9:16', '1:1'], `Replicate/${model}`)
  }
  return normalizeReplicateAspectRatioFrom(aspectRatio, REPLICATE_COMMON_ASPECT_RATIOS, `Replicate/${model}`)
}

export const GEMINI_DURATION_SECONDS = [3, 4, 5, 6, 7, 8, 9, 10] as const
export const GEMINI_DEFAULT_BILLED_DURATION_SECONDS = 10 as const satisfies GeminiDurationSeconds
export const GEMINI_VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const
export const GEMINI_VIDEO_RESOLUTIONS = ['360p', '720p', '1080p', '4k'] as const

export const normalizeGeminiDuration = (
  duration: number | undefined,
  _resolution?: GeminiResolution | string | undefined,
  _mode?: VideoMode | undefined
): GeminiDurationSeconds => {
  if (duration === undefined) return GEMINI_DEFAULT_BILLED_DURATION_SECONDS
  if (!Number.isInteger(duration) || !(GEMINI_DURATION_SECONDS as readonly number[]).includes(duration)) {
    throw UsageError(`Invalid --duration value "${String(duration)}" for Gemini Omni. Expected an integer from 3 to 10.`)
  }
  return duration as GeminiDurationSeconds
}

export const normalizeGeminiResolution = (
  resolution: string | undefined,
  _model?: string | undefined
): GeminiResolution => {
  if (resolution === undefined || resolution === '') return '720p'
  if ((GEMINI_VIDEO_RESOLUTIONS as readonly string[]).includes(resolution)) return resolution as GeminiResolution
  throw UsageError(`Invalid --resolution value "${resolution}" for Gemini Omni. Expected ${GEMINI_VIDEO_RESOLUTIONS.join(', ')}.`)
}

export const normalizeGeminiAspectRatio = (aspectRatio: string | undefined): '16:9' | '9:16' => {
  if (aspectRatio === undefined || aspectRatio === '') return '16:9'
  if (aspectRatio === '16:9' || aspectRatio === '9:16') return aspectRatio
  throw UsageError(`Invalid --aspect-ratio value "${aspectRatio}" for Gemini Omni. Expected ${GEMINI_VIDEO_ASPECT_RATIOS.join(' or ')}.`)
}

export const GROK_VIDEO_DURATION_RANGE = [1, 15] as const

export const normalizeGrokVideoDuration = (duration: number | undefined): GrokVideoDurationSeconds => {
  const [min, max] = GROK_VIDEO_DURATION_RANGE
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 8
  return Math.min(max, Math.max(min, Math.floor(duration))) as GrokVideoDurationSeconds
}

export const GROK_VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'] as const

export const normalizeGrokVideoResolution = (resolution: string | undefined, model?: string | undefined): GrokVideoResolution => {
  if (resolution === undefined || resolution === '') return '480p'
  if (resolution === '480p' || resolution === '720p' || resolution === '1080p') return resolution
  throw UsageError(`Invalid --resolution value "${resolution}" for Grok/${model ?? 'video'}. Expected ${GROK_VIDEO_RESOLUTIONS.join(', ')}.`)
}

export const GROK_VIDEO_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const

export const normalizeGrokVideoAspectRatio = (aspectRatio: string | undefined): string => {
  const allowed = new Set<string>(GROK_VIDEO_ASPECT_RATIOS)
  return aspectRatio && allowed.has(aspectRatio) ? aspectRatio : '16:9'
}

export const normalizeLtxVideoResolution = (resolution: string | undefined, _model?: LtxVideoModel): '720p' | '1080p' | '1440p' | '4k' => {
  if (resolution === undefined || resolution === '') return '1080p'
  if ((LTX_RESOLUTIONS as readonly string[]).includes(resolution)) return resolution as '720p' | '1080p' | '1440p' | '4k'
  throw UsageError(`Invalid --resolution value "${resolution}" for LTX. Expected ${LTX_RESOLUTIONS.join(' or ')}.`)
}

export const normalizeLtxVideoAspectRatio = (model: LtxVideoModel, aspectRatio: string | undefined): '16:9' | '9:16' => {
  if (aspectRatio === undefined || aspectRatio === '') return '16:9'
  if (aspectRatio === '16:9') return '16:9'
  if (aspectRatio === '9:16') return '9:16'
  throw UsageError(`Invalid --aspect-ratio value "${aspectRatio}" for LTX ${model}. Expected ${LTX_ASPECT_RATIOS.join(' or ')}.`)
}

export const normalizeLtxVideoSize = (
  model: LtxVideoModel,
  resolution: string | undefined,
  aspectRatio: string | undefined
): string => {
  const normalizedResolution = normalizeLtxVideoResolution(resolution, model)
  const normalizedAspectRatio = normalizeLtxVideoAspectRatio(model, aspectRatio)
  if (normalizedResolution === '720p') return normalizedAspectRatio === '9:16' ? '720x1280' : '1280x720'
  if (normalizedResolution === '1440p') return normalizedAspectRatio === '9:16' ? '1440x2560' : '2560x1440'
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
  throw UsageError(`Invalid --resolution value "${resolution}" for Luma Labs. Expected ${LUMA_RESOLUTIONS.join(', ')}.`)
}

export const normalizeLumaVideoAspectRatio = (aspectRatio: string | undefined): string => {
  if (aspectRatio === undefined || aspectRatio === '') return '16:9'
  if ((LUMA_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) return aspectRatio
  throw UsageError(`Invalid --aspect-ratio value "${aspectRatio}" for Luma Labs. Expected ${LUMA_ASPECT_RATIOS.join(', ')}.`)
}

export const LTX_DURATION_SECONDS = [6, 8, 10] as const
export const LTX_FAST_1080P_DURATION_SECONDS = [6, 8, 10, 12, 14, 16, 18, 20] as const
export const LTX_RESOLUTIONS = ['720p', '1080p', '1440p', '4k'] as const
export const LTX_ASPECT_RATIOS = ['16:9', '9:16'] as const

export const normalizeLtxVideoDuration = (
  model: LtxVideoModel,
  size: string,
  duration: number | undefined,
  mode?: string | undefined
): LtxVideoDurationSeconds => {
  if (mode !== undefined && !['text', 'image-to-video', 'interpolate'].includes(mode)) {
    throw UsageError(`--mode ${mode} is not supported by ltx/${model}.`)
  }
  // All CLI LTX requests explicitly use 24 fps. Higher frame rates and automatic duration are not exposed.
  const longClip = model === 'ltx-2-5-fast' && ['1280x720', '720x1280', '1920x1080', '1080x1920'].includes(size)
  const allowed: readonly number[] = longClip ? LTX_FAST_1080P_DURATION_SECONDS : LTX_DURATION_SECONDS
  const requested = duration === undefined ? 8 : duration
  if (!allowed.includes(requested)) {
    throw UsageError(`Invalid --duration value "${duration}" for LTX ${model} at ${size}/24 fps. Expected ${allowed.join(', ')}.`)
  }
  return requested as LtxVideoDurationSeconds
}
