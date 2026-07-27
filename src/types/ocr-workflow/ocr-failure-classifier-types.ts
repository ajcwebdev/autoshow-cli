import type { OcrProviderFailureCategory, OcrProviderFailureKind, OcrTarget } from '~/types'

export type OcrFailureClassificationInput = {
  service?: OcrTarget['service'] | undefined
  message: string
  category?: OcrProviderFailureCategory | undefined
  status?: number | undefined
  headers?: Headers | undefined
  errorType?: string | undefined
  responseType?: string | undefined
  code?: string | undefined
  type?: string | undefined
  rawResponse?: unknown
  body?: unknown
}

export type OcrFailureClassification = {
  category: OcrProviderFailureCategory
  failureKind: OcrProviderFailureKind
  retryable: boolean
  quota?: boolean | undefined
  providerWide?: boolean | undefined
  blockedReason?: string | undefined
}
