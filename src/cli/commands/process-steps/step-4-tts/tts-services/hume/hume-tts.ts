import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureHumeTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('HUME_API_KEY')
  if (!apiKey) {
    throw InternalError('HUME_API_KEY environment variable is required for Hume TTS', { stage: 'tts:hume', hints: hintsForMissingEnv('HUME_API_KEY') })
  }
}
