import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureElevenLabsMusicGenSetup = async (): Promise<void> => { resolveCredential('elevenlabs', 'require', { stage: 'music:elevenlabs', description: 'ElevenLabs music generation' }) }
