import { ensureProvider } from '~/utils/validate/env-utils'

export const ensureTogetherSttSetup = ensureProvider('together', 'stt:together', 'Together transcription')
