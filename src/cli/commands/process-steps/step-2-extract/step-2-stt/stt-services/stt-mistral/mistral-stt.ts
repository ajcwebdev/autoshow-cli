import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureMistralSttSetup = async (): Promise<void> => { requireProviderKey('mistral', 'stt:mistral', 'Mistral transcription') }
