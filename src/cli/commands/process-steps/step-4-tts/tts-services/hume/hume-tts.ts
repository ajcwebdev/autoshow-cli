import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureHumeTtsSetup = ensureApiKeySetup('HUME_API_KEY', 'tts:hume', 'Hume TTS')
