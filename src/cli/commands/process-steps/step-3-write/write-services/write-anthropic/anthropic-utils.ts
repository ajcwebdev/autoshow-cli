import { requireApiKey } from '~/utils/validate/env-utils'
import { ANTHROPIC_DEFAULT_BASE_URL } from '~/utils/base-urls'
import type { AnthropicRestConfig } from '~/types'

export const getAnthropicClientConfig = (): AnthropicRestConfig => {
  const apiKey = requireApiKey('ANTHROPIC_API_KEY', 'write:anthropic')

  return { apiKey, baseURL: ANTHROPIC_DEFAULT_BASE_URL }
}
