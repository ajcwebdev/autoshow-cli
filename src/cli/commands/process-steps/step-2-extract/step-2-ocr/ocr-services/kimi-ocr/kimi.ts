import { KIMI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireApiKey } from '~/utils/validate/env-utils'

export const KIMI_OCR_IMAGE_BYTES = 100 * 1024 * 1024
export const KIMI_OCR_LIMIT_SOURCE = 'project/links/kimi-general-ocr-text-links.md'

export const resolveKimiBaseUrl = (): string =>
  KIMI_DEFAULT_BASE_URL.trim().replace(/\/+$/, '')

// Kimi K3 runs with always-on thinking, rejects the `thinking` field, and accepts named effort
// through `reasoning_effort`. The K2.x line exposes only the binary `thinking` switch.
// See docs/adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md.
export const acceptsKimiThinkingField = (model: string): boolean =>
  !/^kimi-k3(?:[.-]|$)/i.test(model)

export const ensureKimiApiKey = (serviceName: string): string =>
  requireApiKey('KIMI_API_KEY', 'ocr:kimi', serviceName)

export const ensureKimiOcrSetup = async (): Promise<void> => {
  ensureKimiApiKey('Kimi OCR')
}
