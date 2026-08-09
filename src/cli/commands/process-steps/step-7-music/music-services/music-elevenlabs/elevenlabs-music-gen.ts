import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureElevenLabsMusicGenSetup = ensureApiKeySetup('ELEVENLABS_API_KEY', 'music:elevenlabs', 'ElevenLabs music generation')
