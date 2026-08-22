import { GLADIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ensureProvider } from '~/utils/validate/env-utils'

export const getGladiaBaseUrl = (): string => GLADIA_DEFAULT_BASE_URL

export const ensureGladiaSttSetup = ensureProvider('gladia', 'stt:gladia', 'Gladia transcription')
