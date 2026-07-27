import { REVAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const getRevBaseUrl = (): string => REVAI_DEFAULT_BASE_URL

export const ensureRevSttSetup = async (): Promise<void> => {
  const accessToken = readEnv('REVAI_ACCESS_TOKEN')
  if (!accessToken) {
    throw InternalError('REVAI_ACCESS_TOKEN environment variable is required for Rev transcription', { stage: 'stt:rev', hints: hintsForMissingEnv('REVAI_ACCESS_TOKEN') })
  }
}
