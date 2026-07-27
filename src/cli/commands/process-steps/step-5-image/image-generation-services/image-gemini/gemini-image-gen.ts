import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'
import { readEnv } from '~/utils/validate/env-utils'

export const ensureGeminiImageGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw InternalError('GEMINI_API_KEY environment variable is required for Gemini image generation', { stage: 'image:gemini', hints: hintsForMissingEnv('GEMINI_API_KEY') })
  }
}
