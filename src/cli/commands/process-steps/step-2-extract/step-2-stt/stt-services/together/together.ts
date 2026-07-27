import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureTogetherSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('TOGETHER_API_KEY')
  if (!apiKey) {
    throw InternalError('TOGETHER_API_KEY environment variable is required for Together transcription', { stage: 'stt:together', hints: hintsForMissingEnv('TOGETHER_API_KEY') })
  }
}
