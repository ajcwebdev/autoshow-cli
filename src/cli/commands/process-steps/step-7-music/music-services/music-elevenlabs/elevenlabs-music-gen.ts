import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureElevenLabsMusicGenSetup = ensureProvider('elevenlabs', 'music:elevenlabs', 'ElevenLabs music generation')
