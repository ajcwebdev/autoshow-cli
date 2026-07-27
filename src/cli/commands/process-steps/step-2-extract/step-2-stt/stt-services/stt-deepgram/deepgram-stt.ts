import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureDeepgramSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('DEEPGRAM_API_KEY')
  if (!apiKey) {
    throw InternalError('DEEPGRAM_API_KEY environment variable is required for Deepgram transcription', { stage: 'stt:deepgram', hints: hintsForMissingEnv('DEEPGRAM_API_KEY') })
  }
}
