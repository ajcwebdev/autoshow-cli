import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureHumeTtsSetup = async (): Promise<void> => { resolveCredential('hume', 'require', { stage: 'tts:hume', description: 'Hume TTS' }) }
