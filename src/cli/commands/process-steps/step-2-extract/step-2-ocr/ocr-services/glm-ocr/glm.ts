import { GLM_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireApiKey } from '~/utils/validate/env-utils'

export const resolveGlmBaseUrl = (baseUrl?: string): string => {
  const override = baseUrl?.replace(/\/$/, '')
  if (!override) return GLM_DEFAULT_BASE_URL
  return override.endsWith('/api/paas/v4')
    ? override
    : `${override}/api/paas/v4`
}

export const ensureGlmApiKey = (serviceName: string): string =>
  requireApiKey('GLM_API_KEY', 'ocr:glm', serviceName)

export const ensureGlmOcrSetup = async (): Promise<void> => {
  ensureGlmApiKey('GLM OCR')
}
