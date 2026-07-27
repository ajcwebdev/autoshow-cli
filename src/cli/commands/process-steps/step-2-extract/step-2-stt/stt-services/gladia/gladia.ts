import { GLADIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const getGladiaBaseUrl = (): string => GLADIA_DEFAULT_BASE_URL

export const ensureGladiaSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('GLADIA_API_KEY')
  if (!apiKey) {
    throw InternalError('GLADIA_API_KEY environment variable is required for Gladia transcription', { stage: 'stt:gladia', hints: hintsForMissingEnv('GLADIA_API_KEY') })
  }
}
