import { SPEECHMATICS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ensureProvider } from '~/utils/validate/env-utils'

export const getSpeechmaticsBaseUrl = (): string => SPEECHMATICS_DEFAULT_BASE_URL

export const ensureSpeechmaticsSttSetup = ensureProvider('speechmatics', 'stt:speechmatics', 'Speechmatics transcription')
