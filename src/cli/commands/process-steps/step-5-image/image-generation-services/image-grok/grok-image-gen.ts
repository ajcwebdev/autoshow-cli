import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureGrokImageGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw InternalError('XAI_API_KEY environment variable is required for Grok image generation', { stage: 'image:grok', hints: hintsForMissingEnv('XAI_API_KEY') })
  }
}
