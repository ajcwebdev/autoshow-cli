import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureMistralSttSetup = ensureApiKeySetup('MISTRAL_API_KEY', 'stt:mistral', 'Mistral transcription')
