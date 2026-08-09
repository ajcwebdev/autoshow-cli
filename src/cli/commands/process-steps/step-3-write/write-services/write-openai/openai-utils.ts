import { requireApiKey } from '~/utils/validate/env-utils'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getOpenAIClientConfig = (baseUrl: string = OPENAI_DEFAULT_BASE_URL): { apiKey: string, baseURL: string } => {
  const apiKey = requireApiKey('OPENAI_API_KEY', 'write:openai')
  return { apiKey, baseURL: baseUrl }
}
