import { readEnv } from '~/utils/validate/env-utils'
import { REVE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

const getReveApiKey = (): string | undefined => readEnv('REVE_API_KEY')

export const getReveBaseUrl = (baseUrl: string = REVE_DEFAULT_BASE_URL): string => {
  return baseUrl.replace(/\/+$/, '')
}

export const ensureReveImageGenSetup = async (): Promise<string> => {
  const apiKey = getReveApiKey()
  if (!apiKey) {
    throw InternalError('REVE_API_KEY environment variable is required for Reve image generation', { stage: 'image:reve', hints: hintsForMissingEnv('REVE_API_KEY') })
  }
  return apiKey
}
