import type { GeminiPart } from '~/types'

export type GeminiMusicResponsePart = Pick<GeminiPart, 'thought' | 'text' | 'inlineData'>
