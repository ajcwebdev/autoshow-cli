import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureGrokTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw InternalError('XAI_API_KEY environment variable is required for Grok TTS', { stage: 'tts:grok', hints: hintsForMissingEnv('XAI_API_KEY') })
  }
}
