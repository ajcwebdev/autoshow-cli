import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureDeepgramTtsSetup = ensureApiKeySetup('DEEPGRAM_API_KEY', 'tts:deepgram', 'Deepgram TTS')
