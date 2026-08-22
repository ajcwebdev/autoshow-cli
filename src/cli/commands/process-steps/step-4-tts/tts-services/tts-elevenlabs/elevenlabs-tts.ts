import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureElevenLabsTtsSetup = ensureProvider('elevenlabs', 'tts:elevenlabs', 'ElevenLabs TTS')
