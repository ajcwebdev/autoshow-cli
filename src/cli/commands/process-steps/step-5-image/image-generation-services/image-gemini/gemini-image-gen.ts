import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureGeminiImageGenSetup = async (): Promise<void> => { resolveCredential('gemini', 'require', { stage: 'image:gemini', description: 'Gemini image generation' }) }
