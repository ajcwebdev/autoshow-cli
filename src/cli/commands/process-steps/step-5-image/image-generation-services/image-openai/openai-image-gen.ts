import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureOpenAIImageGenSetup = ensureProvider('openai', 'image:openai', 'OpenAI image generation')
