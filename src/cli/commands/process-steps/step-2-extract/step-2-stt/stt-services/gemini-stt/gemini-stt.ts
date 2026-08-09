import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureGeminiSttSetup = ensureApiKeySetup('GEMINI_API_KEY', 'stt:gemini', 'Gemini transcription')
