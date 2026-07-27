import { readEnv } from '~/utils/validate/env-utils'
import { LUMALABS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

const getLumalabsApiKey = (): string | undefined => readEnv('LUMA_AGENTS_API_KEY')

export const getLumalabsBaseUrl = (baseUrl: string = LUMALABS_DEFAULT_BASE_URL): string => {
  return baseUrl.replace(/\/+$/, '')
}

export const ensureLumalabsImageGenSetup = async (): Promise<string> => {
  const apiKey = getLumalabsApiKey()
  if (!apiKey) {
    throw InternalError('LUMA_AGENTS_API_KEY environment variable is required for Luma Labs image generation', { stage: 'image:lumalabs', hints: hintsForMissingEnv('LUMA_AGENTS_API_KEY') })
  }
  return apiKey
}
