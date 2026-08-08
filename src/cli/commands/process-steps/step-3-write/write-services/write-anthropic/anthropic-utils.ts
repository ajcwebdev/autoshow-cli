import { readEnv } from '~/utils/validate/env-utils'
import { ANTHROPIC_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'
import type { AnthropicRestConfig } from '~/types'

export const getAnthropicClientConfig = (): AnthropicRestConfig => {
  const apiKey = readEnv('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw InternalError('ANTHROPIC_API_KEY environment variable is required', { stage: 'write:anthropic', hints: hintsForMissingEnv('ANTHROPIC_API_KEY') })
  }

  return { apiKey, baseURL: ANTHROPIC_DEFAULT_BASE_URL }
}
