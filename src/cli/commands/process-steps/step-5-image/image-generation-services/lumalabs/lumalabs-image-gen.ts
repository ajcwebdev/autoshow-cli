import { requireApiKey } from '~/utils/validate/env-utils'
import { LUMALABS_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getLumalabsBaseUrl = (baseUrl: string = LUMALABS_DEFAULT_BASE_URL): string => {
  return baseUrl.replace(/\/+$/, '')
}

export const ensureLumalabsImageGenSetup = async (): Promise<string> => requireApiKey('LUMA_AGENTS_API_KEY', 'image:lumalabs', 'Luma Labs image generation')
