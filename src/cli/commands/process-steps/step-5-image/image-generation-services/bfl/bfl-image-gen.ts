import { resolveCredential } from '~/utils/validate/env-utils'
import { BFL_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getBflBaseUrl = (): string => BFL_DEFAULT_BASE_URL.replace(/\/+$/, '')

export const ensureBflImageGenSetup = async (): Promise<string> => resolveCredential('bfl', 'require', { stage: 'image:bfl', description: 'BFL image generation' })
