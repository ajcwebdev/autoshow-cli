import { RECRAFT_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

const getRecraftApiToken = (): string | undefined => readEnv('RECRAFT_API_TOKEN')

export const getRecraftBaseUrl = (baseUrl: string = RECRAFT_DEFAULT_BASE_URL): string =>
  baseUrl.replace(/\/+$/, '')

export const ensureRecraftImageGenSetup = async (): Promise<string> => {
  const apiToken = getRecraftApiToken()
  if (!apiToken) {
    throw InternalError('RECRAFT_API_TOKEN environment variable is required for Recraft image generation', { stage: 'image:recraft', hints: hintsForMissingEnv('RECRAFT_API_TOKEN') })
  }
  return apiToken
}
