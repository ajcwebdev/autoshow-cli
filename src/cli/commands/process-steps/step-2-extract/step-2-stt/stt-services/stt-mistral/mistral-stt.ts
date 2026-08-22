import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureMistralSttSetup = ensureProvider('mistral', 'stt:mistral', 'Mistral transcription')
