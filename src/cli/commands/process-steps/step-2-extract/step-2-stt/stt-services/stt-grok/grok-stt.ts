import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureGrokSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw InternalError('XAI_API_KEY environment variable is required for Grok STT', { stage: 'stt:grok', hints: hintsForMissingEnv('XAI_API_KEY') })
  }
}
