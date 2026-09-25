export const TTS_PROVIDERS = ['gemini', 'elevenlabs', 'soniox', 'grok', 'mistral', 'openai', 'inworld'] as const
export type TtsProvider = typeof TTS_PROVIDERS[number]

const IMAGE_PROVIDERS = ['gemini', 'openai', 'grok', 'replicate', 'lumalabs', 'fal'] as const
export type ImageProvider = typeof IMAGE_PROVIDERS[number]

const VIDEO_PROVIDERS = ['gemini', 'grok', 'ltx', 'replicate', 'lumalabs', 'fal'] as const
export type VideoProvider = typeof VIDEO_PROVIDERS[number]

const MUSIC_PROVIDERS = ['elevenlabs', 'minimax', 'gemini'] as const
export type MusicProvider = typeof MUSIC_PROVIDERS[number]
