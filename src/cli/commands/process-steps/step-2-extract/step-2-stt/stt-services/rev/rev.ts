import { REVAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ensureProvider } from '~/utils/validate/env-utils'

export const getRevBaseUrl = (): string => REVAI_DEFAULT_BASE_URL

export const ensureRevSttSetup = ensureProvider('rev', 'stt:rev', 'Rev transcription')
