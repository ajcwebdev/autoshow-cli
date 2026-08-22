import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureMistralTtsSetup = ensureProvider('mistral', 'tts:mistral', 'Mistral TTS')
