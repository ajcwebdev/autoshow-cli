import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureElevenLabsTtsSetup = async (): Promise<void> => { requireProviderKey('elevenlabs', 'tts:elevenlabs', 'ElevenLabs TTS') }
