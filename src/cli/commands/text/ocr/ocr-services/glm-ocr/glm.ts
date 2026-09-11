import { GLM_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { resolveCredential } from '~/utils/validate/env-utils'

export const resolveGlmBaseUrl = (baseUrl?: string): string => {
  const override = baseUrl?.replace(/\/$/, '')
  if (!override) return GLM_DEFAULT_BASE_URL
  return override.endsWith('/api/paas/v4')
    ? override
    : `${override}/api/paas/v4`
}

export const ensureGlmApiKey = (serviceName: string, stage: string): string =>
  resolveCredential('glm', 'require', { stage: stage, description: serviceName })

export const ensureGlmOcrSetup = async (): Promise<void> => {
  ensureGlmApiKey('GLM OCR', 'ocr:glm')
}
