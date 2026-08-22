import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureGrokImageGenSetup = ensureProvider('grok', 'image:grok', 'Grok image generation')
