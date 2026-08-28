import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureGeminiTtsSetup = async (): Promise<void> => { resolveCredential('gemini', 'require', { stage: 'tts:gemini', description: 'Gemini TTS' }) }
