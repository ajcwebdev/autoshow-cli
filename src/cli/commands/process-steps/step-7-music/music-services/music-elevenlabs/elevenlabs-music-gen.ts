import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureElevenLabsMusicGenSetup = async (): Promise<void> => { requireProviderKey('elevenlabs', 'music:elevenlabs', 'ElevenLabs music generation') }
