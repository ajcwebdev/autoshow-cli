import { isRecord } from '~/utils/rest-client'
import type { OcrFailureClassification, OcrFailureClassificationInput, OcrProviderFailureCategory, OcrProviderFailureKind, OcrTarget } from '~/types'
import { extractErrorMetadata } from '~/utils/error-handler'
import { sanitizeLogText } from '~/utils/app-logger/redaction'


const toSearchText = (value: unknown): string => {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const getStatusFromMetadata = (metadata: Record<string, unknown>): number | undefined =>
  typeof metadata['status'] === 'number' ? metadata['status'] : undefined

const getHeadersFromMetadata = (metadata: Record<string, unknown>): Headers | undefined =>
  metadata['headers'] instanceof Headers ? metadata['headers'] : undefined

const inferService = (
  service: OcrTarget['service'] | undefined,
  text: string
): OcrTarget['service'] | undefined => {
  if (service) {
    return service
  }
  if (/\bkimi(?:[-\s]?ocr)?\b/i.test(text)) {
    return 'kimi'
  }
  if (/\banthropic(?:[-\s]?ocr)?\b|\bclaude\b/i.test(text)) {
    return 'anthropic'
  }
  return undefined
}

const hasNoRetryHeader = (headers: Headers | undefined): boolean => {
  if (!headers) {
    return false
  }
  for (const name of ['x-should-retry', 'anthropic-should-retry', 'x-provider-should-retry']) {
    const value = headers.get(name)
    if (typeof value === 'string' && /^(?:false|0|no)$/i.test(value.trim())) {
      return true
    }
  }
  return false
}

const KIMI_QUOTA_BLOCKER_PATTERN = /insufficient\s+(?:account\s+)?balance|balance\s+(?:is\s+)?(?:not\s+enough|insufficient)|not\s+enough\s+balance|quota(?:[_\s-]?exceeded|[_\s-]?insufficient)?|billing\s+(?:required|details|quota|limit)|payment\s+required|top\s*up|recharge|credits?\s+(?:exhausted|depleted|insufficient)|account\s+suspended|suspended\s+account/i
const ACCOUNT_SUSPENDED_PATTERN = /account\s+suspended|suspended\s+account/i
const BILLING_REQUIRED_PATTERN = /billing\s+(?:required|details|quota|limit)|payment\s+required|top\s*up|recharge/i
const INSUFFICIENT_BALANCE_PATTERN = /insufficient\s+(?:account\s+)?balance|balance\s+(?:is\s+)?(?:not\s+enough|insufficient)|not\s+enough\s+balance|credits?\s+(?:exhausted|depleted|insufficient)/i
const CONTENT_POLICY_PATTERN = /content (?:filter|filtering|policy)|blocked by content|safety|policy violation|moderation|invalid_request_error/i
const STRUCTURED_VALIDATION_PATTERN = /not valid json|malformed json|schema|expected page schema|returned \d+ pages|non-contiguous page numbers|returned no pages|returned no text output/i
const PDF_CHUNK_RENDER_PATTERN = /pdf chunk creation failed|mutool convert failed|stage=pdf_chunk_render/i
const AUTH_MESSAGE_PATTERN = /(?:api key|environment variable is required|auth(?:entication|orization)?|unauthori[sz]ed|forbidden|invalid api key|permission denied|access denied|credential|not configured)/i
const RATE_LIMIT_MESSAGE_PATTERN = /rate limit|too many requests|\b429\b/i
const TIMEOUT_MESSAGE_PATTERN = /timed out|timeout|deadline exceeded|abort\/timeout/i
const NETWORK_MESSAGE_PATTERN = /network|connection|socket|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|fetch failed|unavailable|overloaded/i
const PROVIDER_LIMIT_MESSAGE_PATTERN = /exceeds|too large|supports .* up to|file upload limit|page(?:s)? .*limit|maximum|payload too large|\b413\b|split .*smaller chunks?|image input exceeds/i

const categorize = (
  input: OcrFailureClassificationInput,
  text: string
): OcrProviderFailureCategory => {
  if (input.category) {
    return input.category
  }
  if (PDF_CHUNK_RENDER_PATTERN.test(text)) {
    return 'pdf_chunk_render'
  }
  if (CONTENT_POLICY_PATTERN.test(text)) {
    return 'content_policy'
  }
  if (input.status === 401 || input.status === 403 || AUTH_MESSAGE_PATTERN.test(text)) {
    return 'auth'
  }
  if (input.status === 429 || RATE_LIMIT_MESSAGE_PATTERN.test(text)) {
    return 'rate_limit'
  }
  if (input.status === 413 || PROVIDER_LIMIT_MESSAGE_PATTERN.test(text)) {
    return 'provider_limit'
  }
  if (STRUCTURED_VALIDATION_PATTERN.test(text)) {
    return 'structured_response'
  }
  if (TIMEOUT_MESSAGE_PATTERN.test(text)) {
    return 'timeout'
  }
  if (NETWORK_MESSAGE_PATTERN.test(text) || (typeof input.status === 'number' && input.status >= 500)) {
    return 'network'
  }
  return 'unknown'
}

const blockedReasonForKimiQuota = (text: string): string => {
  if (ACCOUNT_SUSPENDED_PATTERN.test(text)) {
    return 'account_suspended'
  }
  if (INSUFFICIENT_BALANCE_PATTERN.test(text)) {
    return 'insufficient_balance'
  }
  if (BILLING_REQUIRED_PATTERN.test(text)) {
    return 'billing_required'
  }
  return 'quota_or_billing'
}

const categoryToKind = (category: OcrProviderFailureCategory): OcrProviderFailureKind =>
  category

export const classifyOcrFailureSummary = (
  input: OcrFailureClassificationInput
): OcrFailureClassification => {
  const combinedText = sanitizeLogText([
    input.message,
    input.errorType,
    input.responseType,
    input.code,
    input.type,
    toSearchText(input.rawResponse),
    toSearchText(input.body)
  ].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0).join(' '))
  const service = inferService(input.service, combinedText)
  const category = categorize(input, combinedText)

  if (
    service === 'kimi'
    && (input.status === 429 || input.status === 402)
    && KIMI_QUOTA_BLOCKER_PATTERN.test(combinedText)
  ) {
    return {
      category,
      failureKind: 'quota',
      retryable: false,
      quota: true,
      providerWide: true,
      blockedReason: blockedReasonForKimiQuota(combinedText)
    }
  }

  if (service === 'anthropic' && input.status === 400 && CONTENT_POLICY_PATTERN.test(combinedText)) {
    return {
      category: 'content_policy',
      failureKind: 'content_policy',
      retryable: false,
      providerWide: true,
      blockedReason: 'content_policy'
    }
  }

  if (service === 'anthropic' && hasNoRetryHeader(input.headers)) {
    return {
      category,
      failureKind: 'provider_no_retry',
      retryable: false,
      providerWide: true,
      blockedReason: 'provider_no_retry_header'
    }
  }

  if (category === 'auth') {
    return {
      category,
      failureKind: 'auth',
      retryable: false,
      providerWide: true,
      blockedReason: 'auth'
    }
  }

  if (category === 'content_policy') {
    return {
      category,
      failureKind: 'content_policy',
      retryable: false,
      providerWide: true,
      blockedReason: 'content_policy'
    }
  }

  if (category === 'provider_limit') {
    return {
      category,
      failureKind: 'provider_limit',
      retryable: false,
      blockedReason: 'provider_limit'
    }
  }

  if (input.status === 402) {
    return {
      category,
      failureKind: 'quota',
      retryable: false,
      quota: true,
      providerWide: true,
      blockedReason: 'billing_required'
    }
  }

  if (input.status === 400 || input.status === 404 || input.status === 422) {
    return {
      category,
      failureKind: categoryToKind(category),
      retryable: false,
      blockedReason: category
    }
  }

  return {
    category,
    failureKind: categoryToKind(category),
    retryable: true
  }
}

export const classifyOcrErrorForRetry = (error: unknown): OcrFailureClassification => {
  const metadata = extractErrorMetadata(error)
  const message = error instanceof Error ? error.message : String(error)
  const rawResponse = metadata['rawResponse']
  const body = metadata['body']
  const service = isRecord(metadata['target']) && typeof metadata['target']['service'] === 'string'
    ? metadata['target']['service'] as OcrTarget['service']
    : undefined

  return classifyOcrFailureSummary({
    service,
    message,
    category: typeof metadata['category'] === 'string' ? metadata['category'] as OcrProviderFailureCategory : undefined,
    status: getStatusFromMetadata(metadata),
    headers: getHeadersFromMetadata(metadata),
    errorType: typeof metadata['errorType'] === 'string' ? metadata['errorType'] : undefined,
    responseType: typeof metadata['responseType'] === 'string' ? metadata['responseType'] : undefined,
    code: typeof metadata['code'] === 'string' ? metadata['code'] : undefined,
    type: typeof metadata['type'] === 'string' ? metadata['type'] : undefined,
    rawResponse,
    body
  })
}
