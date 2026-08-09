import { SPEECHMATICS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ensureApiKeySetup } from '~/utils/validate/env-utils'

export const getSpeechmaticsBaseUrl = (): string => SPEECHMATICS_DEFAULT_BASE_URL

export const ensureSpeechmaticsSttSetup = ensureApiKeySetup('SPEECHMATICS_API_KEY', 'stt:speechmatics', 'Speechmatics transcription')
