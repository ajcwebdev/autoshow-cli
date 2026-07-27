import { KIMI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const KIMI_OCR_IMAGE_BYTES = 100 * 1024 * 1024
export const KIMI_OCR_LIMIT_SOURCE = 'project/links/kimi-general-ocr-text-links.md'

export const resolveKimiBaseUrl = (): string =>
  KIMI_DEFAULT_BASE_URL.trim().replace(/\/+$/, '')

// Kimi K3 runs with always-on thinking that cannot be turned off, and rejects the `thinking`
// request field outright. The K2.x line still needs it to opt out of thinking. Neither path
// sends `reasoning_effort`; the provider default applies until a general thinking-configuration
// flag exists. See docs/adr/ADR-011-refresh-current-hosted-llm-and-ocr-models.md.
export const acceptsKimiThinkingField = (model: string): boolean =>
  !/^kimi-k3(?:[.-]|$)/i.test(model)

const getKimiApiKey = (): string | undefined => {
  return readEnv('KIMI_API_KEY')
}

export const ensureKimiApiKey = (serviceName: string): string => {
  const apiKey = getKimiApiKey()
  if (!apiKey) {
    throw InternalError(`KIMI_API_KEY environment variable is required for ${serviceName}`, { stage: 'ocr:kimi', hints: hintsForMissingEnv('KIMI_API_KEY') })
  }
  return apiKey
}

export const ensureKimiOcrSetup = async (): Promise<void> => {
  ensureKimiApiKey('Kimi OCR')
}
