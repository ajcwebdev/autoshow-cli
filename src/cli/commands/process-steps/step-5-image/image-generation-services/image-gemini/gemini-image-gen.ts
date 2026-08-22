import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureGeminiImageGenSetup = async (): Promise<void> => { requireProviderKey('gemini', 'image:gemini', 'Gemini image generation') }
