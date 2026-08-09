import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureOpenAIImageGenSetup = ensureApiKeySetup('OPENAI_API_KEY', 'image:openai', 'OpenAI image generation')
