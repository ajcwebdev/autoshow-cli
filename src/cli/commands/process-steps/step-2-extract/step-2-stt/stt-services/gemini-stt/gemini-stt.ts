import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureGeminiSttSetup = ensureProvider('gemini', 'stt:gemini', 'Gemini transcription')
