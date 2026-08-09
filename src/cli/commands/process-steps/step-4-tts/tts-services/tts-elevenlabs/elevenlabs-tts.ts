import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureElevenLabsTtsSetup = ensureApiKeySetup('ELEVENLABS_API_KEY', 'tts:elevenlabs', 'ElevenLabs TTS')
