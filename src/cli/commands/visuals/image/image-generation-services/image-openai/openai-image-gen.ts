import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureOpenAIImageGenSetup = async (): Promise<void> => { resolveCredential('openai', 'require', { stage: 'image:openai', description: 'OpenAI image generation' }) }
