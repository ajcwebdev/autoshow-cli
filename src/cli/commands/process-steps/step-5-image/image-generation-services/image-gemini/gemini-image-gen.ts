import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureGeminiImageGenSetup = ensureApiKeySetup('GEMINI_API_KEY', 'image:gemini', 'Gemini image generation')
