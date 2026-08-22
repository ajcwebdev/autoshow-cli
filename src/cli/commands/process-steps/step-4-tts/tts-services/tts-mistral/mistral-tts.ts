import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureMistralTtsSetup = async (): Promise<void> => { requireProviderKey('mistral', 'tts:mistral', 'Mistral TTS') }
