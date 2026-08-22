import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureGroqSttSetup = ensureProvider('groq', 'stt:groq', 'Groq STT models')
