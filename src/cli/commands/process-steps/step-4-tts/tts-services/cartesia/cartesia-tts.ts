import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureCartesiaTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('CARTESIA_API_KEY')
  if (!apiKey) {
    throw InternalError('CARTESIA_API_KEY environment variable is required for Cartesia TTS', { stage: 'tts:cartesia', hints: hintsForMissingEnv('CARTESIA_API_KEY') })
  }
}
