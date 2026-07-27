import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureElevenLabsMusicGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw InternalError('ELEVENLABS_API_KEY environment variable is required for ElevenLabs music generation', { stage: 'music:elevenlabs', hints: hintsForMissingEnv('ELEVENLABS_API_KEY') })
  }
}
