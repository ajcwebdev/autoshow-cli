import { requireProviderKey } from '~/utils/validate/env-utils'

export const ensureGrokSttSetup = async (): Promise<void> => { requireProviderKey('grok', 'stt:grok', 'Grok STT') }
