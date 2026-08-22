import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureGrokTtsSetup = ensureProvider('grok', 'tts:grok', 'Grok TTS')
