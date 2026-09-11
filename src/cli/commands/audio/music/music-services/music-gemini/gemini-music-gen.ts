import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureGeminiMusicGenSetup = async (): Promise<void> => { resolveCredential('gemini', 'require', { stage: 'music:gemini', description: 'Gemini music generation' }) }
