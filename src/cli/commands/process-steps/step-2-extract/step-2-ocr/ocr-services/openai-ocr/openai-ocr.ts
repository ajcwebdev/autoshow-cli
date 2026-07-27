import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const ensureOpenAIOcrSetup = async (): Promise<void> => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw InternalError('OPENAI_API_KEY environment variable is required for OpenAI OCR', { stage: 'ocr:openai', hints: hintsForMissingEnv('OPENAI_API_KEY') })
  }
}
