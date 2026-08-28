import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureMistralTtsSetup = async (): Promise<void> => { resolveCredential('mistral', 'require', { stage: 'tts:mistral', description: 'Mistral TTS' }) }
