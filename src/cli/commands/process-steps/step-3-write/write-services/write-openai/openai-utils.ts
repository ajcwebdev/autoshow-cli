import { requireProviderKey } from '~/utils/validate/env-utils'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getOpenAIClientConfig = (baseUrl: string = OPENAI_DEFAULT_BASE_URL): { apiKey: string, baseURL: string } => {
  const apiKey = requireProviderKey('openai', 'write:openai')
  return { apiKey, baseURL: baseUrl }
}
