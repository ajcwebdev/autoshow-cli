import { KIMI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireApiKey } from '~/utils/validate/env-utils'

export const KIMI_OCR_IMAGE_BYTES = 100 * 1024 * 1024
export const KIMI_OCR_LIMIT_SOURCE = 'project/links/kimi-general-ocr-text-links.md'

export const resolveKimiBaseUrl = (): string =>
  KIMI_DEFAULT_BASE_URL.trim().replace(/\/+$/, '')

// The stage comes from the call site: write and OCR callers share this helper,
// and a hardcoded stage made write failures report `ocr:kimi`.
export const ensureKimiApiKey = (serviceName: string, stage: string): string =>
  requireApiKey('KIMI_API_KEY', stage, serviceName)

export const ensureKimiOcrSetup = async (): Promise<void> => {
  ensureKimiApiKey('Kimi OCR', 'ocr:kimi')
}
