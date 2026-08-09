import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureGrokTtsSetup = ensureApiKeySetup('XAI_API_KEY', 'tts:grok', 'Grok TTS')
