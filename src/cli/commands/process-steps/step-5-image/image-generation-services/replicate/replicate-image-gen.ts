import { REPLICATE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

const getReplicateApiToken = (): string | undefined => readEnv('REPLICATE_API_TOKEN')

export const getReplicateBaseUrl = (baseUrl: string = REPLICATE_DEFAULT_BASE_URL): string =>
  baseUrl.replace(/\/+$/, '')

export const ensureReplicateSetup = async (label: string): Promise<string> => {
  const apiToken = getReplicateApiToken()
  if (!apiToken) {
    throw InternalError(`REPLICATE_API_TOKEN environment variable is required for ${label}`, { stage: 'image:replicate', hints: hintsForMissingEnv('REPLICATE_API_TOKEN') })
  }
  return apiToken
}

export const ensureReplicateImageGenSetup = async (): Promise<string> => {
  return await ensureReplicateSetup('Replicate image generation')
}
