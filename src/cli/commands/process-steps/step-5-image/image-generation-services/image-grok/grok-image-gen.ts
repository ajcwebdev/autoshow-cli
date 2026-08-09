import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureGrokImageGenSetup = ensureApiKeySetup('XAI_API_KEY', 'image:grok', 'Grok image generation')
