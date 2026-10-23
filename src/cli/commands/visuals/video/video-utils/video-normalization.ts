import type { GeminiDurationSeconds, GeminiResolution, GrokVideoDurationSeconds, GrokVideoResolution, VideoMode } from '~/types'
import { UsageError } from '~/utils/error-handler'

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
