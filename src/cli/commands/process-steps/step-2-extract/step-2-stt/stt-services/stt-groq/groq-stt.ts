import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureGroqSttSetup = ensureApiKeySetup('GROQ_API_KEY', 'stt:groq', 'Groq STT models')
