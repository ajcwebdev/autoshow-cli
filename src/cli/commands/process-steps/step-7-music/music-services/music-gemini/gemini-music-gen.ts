import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureGeminiMusicGenSetup = async (): Promise<void> => { requireProviderKey('gemini', 'music:gemini', 'Gemini music generation') }
