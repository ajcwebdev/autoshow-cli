import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureGrokImageGenSetup = async (): Promise<void> => { resolveCredential('grok', 'require', { stage: 'image:grok', description: 'Grok image generation' }) }
