import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const ensureSonioxSttSetup = ensureApiKeySetup('SONIOX_API_KEY', 'stt:soniox', 'Soniox transcription')
