export const DEFAULT_COST_MULTIPLIER = 1

export const DEFAULT_STT_MS_PER_SECOND = {
  api: 900,
  local: 100,
} as const

export const DEFAULT_EXTRACT_MS_PER_PAGE = 3500

export const DEFAULT_LLM_MS_PER_1K_TOKENS = {
  api: 18_000,
  local: 65_000,
} as const

export const DEFAULT_TTS_MS_PER_1K_CHARS = {
  api: 10_000,
  local: 5_000,
} as const

export const DEFAULT_IMAGE_MS_PER_IMAGE = 12_000
export const DEFAULT_VIDEO_MS_PER_SECOND = 12_000
export const DEFAULT_MUSIC_MS_PER_SECOND = 4_000
