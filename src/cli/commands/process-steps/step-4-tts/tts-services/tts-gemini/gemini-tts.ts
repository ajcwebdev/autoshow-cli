import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureGeminiTtsSetup = ensureApiKeySetup('GEMINI_API_KEY', 'tts:gemini', 'Gemini TTS')
