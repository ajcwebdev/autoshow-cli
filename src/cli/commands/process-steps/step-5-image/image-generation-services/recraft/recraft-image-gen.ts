import { RECRAFT_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireApiKey } from '~/utils/validate/env-utils'

export const getRecraftBaseUrl = (): string => RECRAFT_DEFAULT_BASE_URL.replace(/\/+$/, '')

export const ensureRecraftImageGenSetup = async (): Promise<string> => requireApiKey('RECRAFT_API_TOKEN', 'image:recraft', 'Recraft image generation')
