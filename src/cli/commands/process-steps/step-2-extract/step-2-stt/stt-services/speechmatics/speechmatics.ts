import { SPEECHMATICS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireProviderKey } from '~/utils/validate/env-utils'

export const getSpeechmaticsBaseUrl = (): string => SPEECHMATICS_DEFAULT_BASE_URL

export const ensureSpeechmaticsSttSetup = async (): Promise<void> => { requireProviderKey('speechmatics', 'stt:speechmatics', 'Speechmatics transcription') }
