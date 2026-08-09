import { requireApiKey } from '~/utils/validate/env-utils'
import { BFL_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getBflBaseUrl = (baseUrl: string = BFL_DEFAULT_BASE_URL): string => {
  return baseUrl.replace(/\/+$/, '')
}

export const ensureBflImageGenSetup = async (): Promise<string> => requireApiKey('BFL_API_KEY', 'image:bfl', 'BFL image generation')
