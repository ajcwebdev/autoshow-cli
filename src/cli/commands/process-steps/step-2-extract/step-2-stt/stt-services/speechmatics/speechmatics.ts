import { SPEECHMATICS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const getSpeechmaticsBaseUrl = (): string => SPEECHMATICS_DEFAULT_BASE_URL

export const ensureSpeechmaticsSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('SPEECHMATICS_API_KEY')
  if (!apiKey) {
    throw InternalError('SPEECHMATICS_API_KEY environment variable is required for Speechmatics transcription', { stage: 'stt:speechmatics', hints: hintsForMissingEnv('SPEECHMATICS_API_KEY') })
  }
}
