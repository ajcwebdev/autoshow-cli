import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureAssemblyAiSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('ASSEMBLYAI_API_KEY')
  if (!apiKey) {
    throw InternalError('ASSEMBLYAI_API_KEY environment variable is required for AssemblyAI transcription', { stage: 'stt:assemblyai', hints: hintsForMissingEnv('ASSEMBLYAI_API_KEY') })
  }
}
