import { GLM_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const resolveGlmBaseUrl = (baseUrl?: string): string => {
  const override = baseUrl?.replace(/\/$/, '')
  if (!override) return GLM_DEFAULT_BASE_URL
  return override.endsWith('/api/paas/v4')
    ? override
    : `${override}/api/paas/v4`
}

const getGlmApiKey = (): string | undefined => {
  return readEnv('GLM_API_KEY')
}

export const ensureGlmApiKey = (serviceName: string): string => {
  const apiKey = getGlmApiKey()
  if (!apiKey) {
    throw InternalError(`GLM_API_KEY environment variable is required for ${serviceName}`, { stage: 'ocr:glm', hints: hintsForMissingEnv('GLM_API_KEY') })
  }
  return apiKey
}

export const ensureGlmOcrSetup = async (): Promise<void> => {
  ensureGlmApiKey('GLM OCR')
}
