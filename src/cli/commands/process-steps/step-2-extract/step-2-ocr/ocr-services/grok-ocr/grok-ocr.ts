import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const GROK_OCR_IMAGE_BYTES = 20 * 1024 * 1024
export const GROK_OCR_LIMIT_SOURCE = 'https://docs.x.ai/developers/models'

const resolveGrokOcrBaseUrl = (baseUrl: string = XAI_DEFAULT_BASE_URL): string => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  return trimmed.endsWith('/chat/completions')
    ? trimmed.slice(0, -'/chat/completions'.length)
    : trimmed
}

export const getGrokOcrClientConfig = (baseUrl?: string): { apiKey: string, baseURL: string } => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw InternalError('XAI_API_KEY environment variable is required for Grok OCR', { stage: 'ocr:grok', hints: hintsForMissingEnv('XAI_API_KEY') })
  }

  return {
    apiKey,
    baseURL: resolveGrokOcrBaseUrl(baseUrl)
  }
}

export const ensureGrokOcrSetup = async (): Promise<void> => {
  getGrokOcrClientConfig()
}
