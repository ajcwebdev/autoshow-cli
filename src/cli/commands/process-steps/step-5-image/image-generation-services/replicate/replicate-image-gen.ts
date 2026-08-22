import { REPLICATE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireProviderKey } from '~/utils/validate/env-utils'

export const getReplicateBaseUrl = (): string => REPLICATE_DEFAULT_BASE_URL.replace(/\/+$/, '')

export const ensureReplicateSetup = async (label: string): Promise<string> => requireProviderKey('replicate', 'image:replicate', label)

export const ensureReplicateImageGenSetup = async (): Promise<string> => {
  return await ensureReplicateSetup('Replicate image generation')
}
