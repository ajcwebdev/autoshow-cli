import { readEnv } from '~/utils/validate/env-utils'
import { BFL_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

const getBflApiKey = (): string | undefined => readEnv('BFL_API_KEY')

export const getBflBaseUrl = (baseUrl: string = BFL_DEFAULT_BASE_URL): string => {
  return baseUrl.replace(/\/+$/, '')
}

export const ensureBflImageGenSetup = async (): Promise<string> => {
  const apiKey = getBflApiKey()
  if (!apiKey) {
    throw InternalError('BFL_API_KEY environment variable is required for BFL image generation', { stage: 'image:bfl', hints: hintsForMissingEnv('BFL_API_KEY') })
  }
  return apiKey
}
