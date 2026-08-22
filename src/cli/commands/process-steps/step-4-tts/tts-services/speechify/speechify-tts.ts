import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureSpeechifyTtsSetup = ensureProvider('speechify', 'tts:speechify', 'Speechify TTS')
