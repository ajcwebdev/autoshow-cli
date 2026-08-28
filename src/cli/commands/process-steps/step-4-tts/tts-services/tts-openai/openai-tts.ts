import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureOpenAITtsSetup = async (): Promise<void> => { resolveCredential('openai', 'require', { stage: 'tts:openai', description: 'OpenAI TTS' }) }
