import { SPEECHMATICS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { resolveCredential } from '~/utils/validate/env-utils'

export const getSpeechmaticsBaseUrl = (): string => SPEECHMATICS_DEFAULT_BASE_URL

export const ensureSpeechmaticsSttSetup = async (): Promise<void> => { resolveCredential('speechmatics', 'require', { stage: 'stt:speechmatics', description: 'Speechmatics transcription' }) }
