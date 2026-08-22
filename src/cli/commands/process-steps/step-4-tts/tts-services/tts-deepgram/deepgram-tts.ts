import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureDeepgramTtsSetup = ensureProvider('deepgram', 'tts:deepgram', 'Deepgram TTS')
