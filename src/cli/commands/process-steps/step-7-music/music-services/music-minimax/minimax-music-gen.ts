import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureMinimaxMusicGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('MINIMAX_API_KEY')
  if (!apiKey) {
    throw InternalError('MINIMAX_API_KEY environment variable is required for MiniMax music generation', { stage: 'music:minimax', hints: hintsForMissingEnv('MINIMAX_API_KEY') })
  }
}
