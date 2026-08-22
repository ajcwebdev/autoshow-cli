import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureSonioxSttSetup = ensureProvider('soniox', 'stt:soniox', 'Soniox transcription')
