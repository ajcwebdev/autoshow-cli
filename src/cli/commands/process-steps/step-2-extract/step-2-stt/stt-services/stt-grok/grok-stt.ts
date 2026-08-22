import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureGrokSttSetup = ensureProvider('grok', 'stt:grok', 'Grok STT')
