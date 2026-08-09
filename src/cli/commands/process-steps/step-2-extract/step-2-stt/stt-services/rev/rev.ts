import { REVAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const getRevBaseUrl = (): string => REVAI_DEFAULT_BASE_URL

export const ensureRevSttSetup = ensureApiKeySetup('REVAI_ACCESS_TOKEN', 'stt:rev', 'Rev transcription')
