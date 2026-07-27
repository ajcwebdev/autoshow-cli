import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureSpeechifyTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('SPEECHIFY_API_KEY')
  if (!apiKey) {
    throw InternalError('SPEECHIFY_API_KEY environment variable is required for Speechify TTS', { stage: 'tts:speechify', hints: hintsForMissingEnv('SPEECHIFY_API_KEY') })
  }
}
