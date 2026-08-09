import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureOpenAITtsSetup = ensureApiKeySetup('OPENAI_API_KEY', 'tts:openai', 'OpenAI TTS')
