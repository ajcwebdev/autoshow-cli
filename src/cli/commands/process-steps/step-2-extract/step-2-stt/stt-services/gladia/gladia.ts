import { GLADIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const getGladiaBaseUrl = (): string => GLADIA_DEFAULT_BASE_URL

export const ensureGladiaSttSetup = ensureApiKeySetup('GLADIA_API_KEY', 'stt:gladia', 'Gladia transcription')
