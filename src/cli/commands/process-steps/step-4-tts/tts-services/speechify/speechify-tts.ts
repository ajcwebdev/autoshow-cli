import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureSpeechifyTtsSetup = ensureApiKeySetup('SPEECHIFY_API_KEY', 'tts:speechify', 'Speechify TTS')
