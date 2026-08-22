import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureGroqTtsSetup = ensureProvider('groq', 'tts:groq', 'Groq TTS')
