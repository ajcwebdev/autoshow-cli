import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureElevenLabsTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw InternalError('ELEVENLABS_API_KEY environment variable is required for ElevenLabs TTS', { stage: 'tts:elevenlabs', hints: hintsForMissingEnv('ELEVENLABS_API_KEY') })
  }
}
