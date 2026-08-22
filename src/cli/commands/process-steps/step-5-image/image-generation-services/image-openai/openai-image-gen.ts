import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureOpenAIImageGenSetup = async (): Promise<void> => { requireProviderKey('openai', 'image:openai', 'OpenAI image generation') }
