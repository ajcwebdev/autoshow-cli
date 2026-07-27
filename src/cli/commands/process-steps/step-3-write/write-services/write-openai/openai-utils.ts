import { readEnv } from '~/utils/validate/env-utils'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const getOpenAIClientConfig = (baseUrl: string = OPENAI_DEFAULT_BASE_URL): { apiKey: string, baseURL: string } => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw InternalError('OPENAI_API_KEY environment variable is required', { stage: 'write:openai', hints: hintsForMissingEnv('OPENAI_API_KEY') })
  }
  return { apiKey, baseURL: baseUrl }
}
