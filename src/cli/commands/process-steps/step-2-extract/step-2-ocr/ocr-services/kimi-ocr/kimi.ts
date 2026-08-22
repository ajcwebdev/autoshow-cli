import { KIMI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireProviderKey } from '~/utils/validate/env-utils'

export const KIMI_OCR_IMAGE_BYTES = 100 * 1024 * 1024
export const KIMI_OCR_LIMIT_SOURCE = 'https://platform.kimi.ai/docs/guide/use-kimi-vision-model.md'

export const resolveKimiBaseUrl = (): string =>
  KIMI_DEFAULT_BASE_URL.trim().replace(/\/+$/, '')

export const ensureKimiApiKey = (serviceName: string, stage: string): string =>
  requireProviderKey('kimi', stage, serviceName)

export const ensureKimiOcrSetup = async (): Promise<void> => {
  ensureKimiApiKey('Kimi OCR', 'ocr:kimi')
}
