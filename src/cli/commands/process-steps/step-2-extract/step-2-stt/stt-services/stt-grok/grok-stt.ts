import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureGrokSttSetup = ensureApiKeySetup('XAI_API_KEY', 'stt:grok', 'Grok STT')
