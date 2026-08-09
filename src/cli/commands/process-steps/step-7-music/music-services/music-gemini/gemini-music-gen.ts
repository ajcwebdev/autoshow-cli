import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureGeminiMusicGenSetup = ensureApiKeySetup('GEMINI_API_KEY', 'music:gemini', 'Gemini music generation')
