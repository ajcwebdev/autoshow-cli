import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureGeminiImageGenSetup = ensureProvider('gemini', 'image:gemini', 'Gemini image generation')
