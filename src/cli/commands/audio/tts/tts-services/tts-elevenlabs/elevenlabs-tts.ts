import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureElevenLabsTtsSetup = async (): Promise<void> => { resolveCredential('elevenlabs', 'require', { stage: 'tts:elevenlabs', description: 'ElevenLabs TTS' }) }
