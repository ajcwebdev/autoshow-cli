import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureOpenAITtsSetup = ensureProvider('openai', 'tts:openai', 'OpenAI TTS')
