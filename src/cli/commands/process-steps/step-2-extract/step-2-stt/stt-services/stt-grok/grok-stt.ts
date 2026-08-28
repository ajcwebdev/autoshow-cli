import { resolveCredential } from '~/utils/validate/env-utils'

export const ensureGrokSttSetup = async (): Promise<void> => { resolveCredential('grok', 'require', { stage: 'stt:grok', description: 'Grok STT' }) }
