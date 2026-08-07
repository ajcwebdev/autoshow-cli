import { DEEPINFRA_OCR_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const DEEPINFRA_OCR_IMAGE_BYTES = 20 * 1024 * 1024
export const DEEPINFRA_OCR_LIMIT_SOURCE = 'https://docs.deepinfra.com/chat/vision'

const resolveDeepinfraOcrBaseUrl = (): string =>
  DEEPINFRA_OCR_DEFAULT_BASE_URL.replace(/\/+$/, '')

export const getDeepinfraOcrClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = readEnv('DEEPINFRA_API_KEY')
  if (!apiKey) {
    throw InternalError('DEEPINFRA_API_KEY environment variable is required for DeepInfra OCR', { stage: 'ocr:deepinfra', hints: hintsForMissingEnv('DEEPINFRA_API_KEY') })
  }

  return {
    apiKey,
    baseURL: resolveDeepinfraOcrBaseUrl()
  }
}

export const ensureDeepinfraOcrSetup = async (): Promise<void> => {
  getDeepinfraOcrClientConfig()
}
