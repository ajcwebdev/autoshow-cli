import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureFalVideoGenSetup = async (): Promise<string> => {
  const apiKey = readEnv('FAL_API_KEY')
  if (!apiKey) throw InternalError('FAL_API_KEY environment variable is required for fal.ai video generation', { stage: 'video:fal', hints: hintsForMissingEnv('FAL_API_KEY') })
  return apiKey
}
