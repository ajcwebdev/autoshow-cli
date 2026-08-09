import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureMistralTtsSetup = ensureApiKeySetup('MISTRAL_API_KEY', 'tts:mistral', 'Mistral TTS')
