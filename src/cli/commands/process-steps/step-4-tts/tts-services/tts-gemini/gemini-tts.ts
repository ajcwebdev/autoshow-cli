import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureGeminiTtsSetup = async (): Promise<void> => { requireProviderKey('gemini', 'tts:gemini', 'Gemini TTS') }
