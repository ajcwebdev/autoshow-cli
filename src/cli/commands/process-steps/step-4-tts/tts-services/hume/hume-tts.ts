import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureHumeTtsSetup = ensureProvider('hume', 'tts:hume', 'Hume TTS')
