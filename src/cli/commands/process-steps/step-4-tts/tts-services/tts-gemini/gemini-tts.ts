import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureGeminiTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw InternalError('GEMINI_API_KEY environment variable is required for Gemini TTS', { stage: 'tts:gemini', hints: hintsForMissingEnv('GEMINI_API_KEY') })
  }
}
