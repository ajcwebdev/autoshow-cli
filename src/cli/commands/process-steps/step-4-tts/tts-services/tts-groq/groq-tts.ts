import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureGroqTtsSetup = ensureApiKeySetup('GROQ_API_KEY', 'tts:groq', 'Groq TTS')
