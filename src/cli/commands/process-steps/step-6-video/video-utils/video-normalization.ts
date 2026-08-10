import type { GeminiDurationSeconds, GeminiResolution, GlmVideoDurationSeconds, GlmVideoFps, GlmVideoModel, GlmVideoQuality, GrokVideoDurationSeconds, GrokVideoResolution, LtxVideoDurationSeconds, LtxVideoModel, LumaVideoDuration, LumaVideoResolution, MinimaxApiResolution, MinimaxDurationSeconds, MinimaxResolution, MinimaxVideoModel, ReplicateVideoModel, ReplicateVideoResolution, RunwayDurationSeconds, RunwayRatio, VideoMode } from '~/types'
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

export const isReplicateAlephVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'runwayml/aleph-2'

export const isReplicateWanVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'wan-video/wan-2.7-t2v'

export const isReplicateSeedanceFastVideoModel = (model: ReplicateVideoModel): boolean =>
  model === 'bytedance/seedance-2.0-fast'

export const REPLICATE_HAPPYHORSE_DURATION_RANGE = [3, 15] as const
export const REPLICATE_SEEDANCE_DURATION_RANGE = [-1, 15] as const
export const REPLICATE_WAN_DURATION_RANGE = [2, 15] as const

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
  if (isReplicateAlephVideoModel(model)) {
    return clampIntegerDuration(duration, 5, 2, 30, `Replicate/${model}`)
  }
  return clampIntegerDuration(duration, 5, ...REPLICATE_WAN_DURATION_RANGE, `Replicate/${model}`)
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
  if (isReplicateAlephVideoModel(model)) return '720p'
  if (isReplicateKlingVideoModel(model)) {
    if (resolution === '720p' || resolution === '1080p' || resolution === '4k') return resolution
    throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Replicate/${model}. Expected 720p, 1080p, or 4k.`)
  }
  if (isReplicatePixVerseVideoModel(model)) {
    if (resolution === '360p' || resolution === '540p' || resolution === '720p' || resolution === '1080p') return resolution
    throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Replicate/${model}. Expected 360p, 540p, 720p, or 1080p.`)
  }
  if (isReplicateHappyHorseVideoModel(model) || isReplicateWanVideoModel(model)) {
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

export const isMinimaxHailuoModel = (model: MinimaxVideoModel): boolean => {
  return model === 'MiniMax-Hailuo-2.3'
    || model === 'MiniMax-Hailuo-2.3-Fast'
}

export const normalizeMinimaxResolution = (
  model: MinimaxVideoModel,
  resolution: string | undefined
): MinimaxResolution => {
  if (!isMinimaxHailuoModel(model)) {
    return '720p'
  }
  return resolution === '1080p' ? '1080p' : '720p'
}

export const normalizeMinimaxResolutionForApi = (
  model: MinimaxVideoModel,
  resolution: string | undefined
): MinimaxApiResolution => {
  if (resolution === '1080p') {
    return isMinimaxHailuoModel(model) ? '1080P' : '720P'
  }
  return isMinimaxHailuoModel(model) ? '768P' : '720P'
}

export const MINIMAX_HAILUO_DURATION_SECONDS = [6, 10] as const
export const MINIMAX_RESOLUTIONS = ['720p', '1080p'] as const

export const normalizeMinimaxDuration = (
  model: MinimaxVideoModel,
  resolution: MinimaxResolution,
  duration: number | undefined
): MinimaxDurationSeconds => {
  const [shorter, longer] = MINIMAX_HAILUO_DURATION_SECONDS
  if (!isMinimaxHailuoModel(model)) {
    return shorter
  }
  if (resolution === '1080p') {
    return shorter
  }
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    return shorter
  }
  return Math.floor(duration) <= shorter ? shorter : longer
}

export const normalizeMinimaxDurationForApi = (
  model: MinimaxVideoModel,
  resolution: MinimaxApiResolution,
  duration: number | undefined
): MinimaxDurationSeconds => {
  if (!isMinimaxHailuoModel(model)) {
    return 6
  }
  if (resolution === '1080P') {
    return 6
  }
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    return 6
  }
  return Math.floor(duration) <= 6 ? 6 : 10
}

export const GLM_COGVIDEOX_SIZE_VALUES = [
  '1280x720',
  '720x1280',
  '1024x1024',
  '1920x1080',
  '1080x1920',
  '2048x1080',
  '3840x2160'
] as const

const GLM_COGVIDEOX_SIZES = new Set<string>(GLM_COGVIDEOX_SIZE_VALUES)

export const GLM_COGVIDEOX_DURATION_SECONDS = [5, 10] as const
export const GLM_VIDUQ1_FIXED_DURATION_SECONDS = 5
export const GLM_VIDU2_FIXED_DURATION_SECONDS = 4

export const normalizeGlmDuration = (
  model: GlmVideoModel,
  duration: number | undefined
): GlmVideoDurationSeconds => {
  const [shorter, longer] = GLM_COGVIDEOX_DURATION_SECONDS
  if (model.startsWith('viduq1-')) return GLM_VIDUQ1_FIXED_DURATION_SECONDS
  if (model.startsWith('vidu2-')) return GLM_VIDU2_FIXED_DURATION_SECONDS
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return shorter
  return Math.floor(duration) <= shorter ? shorter : longer
}

export const GLM_VIDU2_SIZE_VALUES = [
  '720x480',
  '1280x720'
] as const

const GLM_VIDU2_SIZES = new Set<string>(GLM_VIDU2_SIZE_VALUES)

export const normalizeGlmSize = (model: GlmVideoModel, size: string | undefined): string => {
  if (model.startsWith('viduq1-')) return '1920x1080'
  if (model.startsWith('vidu2-')) return size && GLM_VIDU2_SIZES.has(size) ? size : '1280x720'
  return size && GLM_COGVIDEOX_SIZES.has(size) ? size : '1920x1080'
}

export const normalizeGlmQuality = (quality: string | undefined): GlmVideoQuality => {
  return quality === 'quality' ? 'quality' : 'speed'
}

export const normalizeGlmFps = (fps: number | undefined): GlmVideoFps => {
  return fps === 60 ? 60 : 30
}

export const GLM_VIDEO_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const

export const normalizeGlmAspectRatio = (aspectRatio: string | undefined): string => {
  const allowed = new Set<string>(GLM_VIDEO_ASPECT_RATIOS)
  return aspectRatio && allowed.has(aspectRatio) ? aspectRatio : '16:9'
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

export const RUNWAY_DURATION_RANGE = [2, 10] as const

export const normalizeRunwayDuration = (duration: number | undefined): RunwayDurationSeconds => {
  const [min, max] = RUNWAY_DURATION_RANGE
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 5
  return Math.min(max, Math.max(min, Math.floor(duration))) as RunwayDurationSeconds
}

// Runway's API takes pixel ratios; the friendly 16:9 / 9:16 forms are accepted and mapped.
export const RUNWAY_ASPECT_RATIO_INPUTS = ['16:9', '9:16', '1280:720', '720:1280'] as const

export const normalizeRunwayRatio = (aspectRatio: string | undefined): RunwayRatio => {
  if (aspectRatio === '9:16' || aspectRatio === '720:1280') return '720:1280'
  return '1280:720'
}

export const LTX_2_3_SIZE_VALUES = [
  '1920x1080',
  '1080x1920',
  '2560x1440',
  '1440x2560',
  '3840x2160',
  '2160x3840'
] as const

const LTX_2_3_SIZES = new Set<string>(LTX_2_3_SIZE_VALUES)

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
  size: string | undefined,
  resolution: string | undefined,
  aspectRatio: string | undefined
): string => {
  if (size !== undefined && size !== '') {
    if (LTX_2_3_SIZES.has(size)) return size
    throw CLIUsageError(`Invalid --video-size value "${size}" for LTX ${model}. Expected ${[...LTX_2_3_SIZES].join(', ')}.`)
  }

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
