import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureDeepinfraSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('DEEPINFRA_API_KEY')
  if (!apiKey) {
    throw InternalError('DEEPINFRA_API_KEY environment variable is required for DeepInfra transcription', { stage: 'stt:deepinfra', hints: hintsForMissingEnv('DEEPINFRA_API_KEY') })
  }
}
