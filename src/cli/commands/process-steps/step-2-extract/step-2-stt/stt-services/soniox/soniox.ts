import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureSonioxSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('SONIOX_API_KEY')
  if (!apiKey) {
    throw InternalError('SONIOX_API_KEY environment variable is required for Soniox transcription', { stage: 'stt:soniox', hints: hintsForMissingEnv('SONIOX_API_KEY') })
  }
}
