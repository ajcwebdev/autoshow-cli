import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureMistralSttSetup = async (): Promise<void> => { resolveCredential('mistral', 'require', { stage: 'stt:mistral', description: 'Mistral transcription' }) }
