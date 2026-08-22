import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureGeminiTtsSetup = ensureProvider('gemini', 'tts:gemini', 'Gemini TTS')
