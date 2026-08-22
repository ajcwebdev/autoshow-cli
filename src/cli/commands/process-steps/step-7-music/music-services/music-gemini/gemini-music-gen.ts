import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureGeminiMusicGenSetup = ensureProvider('gemini', 'music:gemini', 'Gemini music generation')
