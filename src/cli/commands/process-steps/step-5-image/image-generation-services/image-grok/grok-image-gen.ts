import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureGrokImageGenSetup = async (): Promise<void> => { requireProviderKey('grok', 'image:grok', 'Grok image generation') }
