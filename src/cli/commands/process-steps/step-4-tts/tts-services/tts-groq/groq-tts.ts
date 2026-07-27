import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureGroqTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('GROQ_API_KEY')
  if (!apiKey) {
    throw InternalError('GROQ_API_KEY environment variable is required for Groq TTS', { stage: 'tts:groq', hints: hintsForMissingEnv('GROQ_API_KEY') })
  }
}
