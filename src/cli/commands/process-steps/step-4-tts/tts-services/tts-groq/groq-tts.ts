import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureGroqTtsSetup = async (): Promise<void> => { resolveCredential('groq', 'require', { stage: 'tts:groq', description: 'Groq TTS' }) }
