import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureDeepgramTtsSetup = async (): Promise<void> => { resolveCredential('deepgram', 'require', { stage: 'tts:deepgram', description: 'Deepgram TTS' }) }
