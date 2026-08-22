import { requireProviderKey } from '~/utils/validate/env-utils'
import { LUMALABS_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getLumalabsBaseUrl = (): string => LUMALABS_DEFAULT_BASE_URL.replace(/\/+$/, '')

export const ensureLumalabsImageGenSetup = async (): Promise<string> => requireProviderKey('lumalabs', 'image:lumalabs', 'Luma Labs image generation')
