import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureDeepgramTtsSetup = async (): Promise<void> => { requireProviderKey('deepgram', 'tts:deepgram', 'Deepgram TTS') }
