import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureGroqTtsSetup = async (): Promise<void> => { requireProviderKey('groq', 'tts:groq', 'Groq TTS') }
