import { requireApiKey } from '~/utils/validate/env-utils'
import { BFL_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getBflBaseUrl = (): string => BFL_DEFAULT_BASE_URL.replace(/\/+$/, '')

export const ensureBflImageGenSetup = async (): Promise<string> => requireApiKey('BFL_API_KEY', 'image:bfl', 'BFL image generation')
