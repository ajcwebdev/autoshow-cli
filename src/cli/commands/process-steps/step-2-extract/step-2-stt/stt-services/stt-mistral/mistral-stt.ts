import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureMistralSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('MISTRAL_API_KEY')
  if (!apiKey) {
    throw InternalError('MISTRAL_API_KEY environment variable is required for Mistral transcription', { stage: 'stt:mistral', hints: hintsForMissingEnv('MISTRAL_API_KEY') })
  }
}
