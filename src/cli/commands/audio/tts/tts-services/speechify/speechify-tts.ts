import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureSpeechifyTtsSetup = async (): Promise<void> => { resolveCredential('speechify', 'require', { stage: 'tts:speechify', description: 'Speechify TTS' }) }
