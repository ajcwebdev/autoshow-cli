import { DEEPINFRA_OCR_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireApiKey } from '~/utils/validate/env-utils'

export const DEEPINFRA_OCR_IMAGE_BYTES = 20 * 1024 * 1024
export const DEEPINFRA_OCR_LIMIT_SOURCE = 'https://docs.deepinfra.com/chat/vision'

const resolveDeepinfraOcrBaseUrl = (): string =>
  DEEPINFRA_OCR_DEFAULT_BASE_URL.replace(/\/+$/, '')

export const getDeepinfraOcrClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = requireApiKey('DEEPINFRA_API_KEY', 'ocr:deepinfra', 'DeepInfra OCR')

  return {
    apiKey,
    baseURL: resolveDeepinfraOcrBaseUrl()
  }
}

export const ensureDeepinfraOcrSetup = async (): Promise<void> => {
  getDeepinfraOcrClientConfig()
}
