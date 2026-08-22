import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureOpenAITtsSetup = async (): Promise<void> => { requireProviderKey('openai', 'tts:openai', 'OpenAI TTS') }
