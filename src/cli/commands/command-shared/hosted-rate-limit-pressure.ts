import type { ProviderLanePressureFeedback } from '~/types'
import { AppError, getErrorHeaders, isRetryExhaustedError, normalizeErrorHeaders } from '~/utils/error-handler'
import { parseRetryAfterMs } from '~/utils/retries'
import { classifyPaidCreateRetry } from '~/utils/retry-classification'

const readNestedErrorValue = (error: unknown, key: string): unknown => {
  const seen = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if (key in current) return (current as Record<string, unknown>)[key]
    if (current instanceof AppError && key in current.metadata) return current.metadata[key]
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return undefined
}

/** Thin alias so hosted call sites can normalize maps/get-like headers the same way as error-handler. */
export const normalizeRetryHeaders = (headers: unknown): Headers | undefined =>
  normalizeErrorHeaders(headers)

const isExplicitlyNonRetryable = (error: unknown): boolean => {
  const seen = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if (current instanceof AppError && current.retryable === false) return true
    if ('retryable' in current && (current as { retryable?: unknown }).retryable === false) return true
    if (current instanceof AppError && current.metadata['retryable'] === false) return true
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return false
}

const collectErrorChainMessages = (error: unknown): string[] => {
  const messages: string[] = []
  const seen = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if (current instanceof Error) messages.push(current.message)
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return messages
}

const isExplicitlyRateLimited = (status: unknown, category: unknown, code: unknown): boolean =>
  status === 429
  || status === 425
  || (typeof category === 'string' && /rate.?limit|too.?many.?requests|concurrenc/i.test(category))
  || (typeof code === 'string' && /rate.?limit|too.?many.?requests|concurrenc/i.test(code))

export const classifyHostedRateLimitPressure = (
  error: unknown
): ProviderLanePressureFeedback | undefined => {
  // Central terminal floor: explicit false and nested exhaustion must never redispatch paid work.
  if (isExplicitlyNonRetryable(error) || isRetryExhaustedError(error)) {
    return undefined
  }
  // Lane recovery can resend a paid request, so it must satisfy the same
  // admission evidence as provider retries. Wording and category alone cannot
  // establish that the original request was rejected before billing.
  if (!classifyPaidCreateRetry(error).shouldRetry) return undefined

  const status = readNestedErrorValue(error, 'status')
  const category = readNestedErrorValue(error, 'category')
  const code = readNestedErrorValue(error, 'code')
  const message = collectErrorChainMessages(error).join(' ').toLowerCase()
  const classificationText = `${typeof category === 'string' ? category : ''} ${typeof code === 'string' ? code : ''} ${message}`.toLowerCase()
  if (/billing|payment required|insufficient (?:balance|credit)|quota[_\s-]*(?:exhaust|exceed|deplet)|exceed(?:ed|s|ing)? (?:your )?(?:current )?quota|quota[_\s-]*limit[_\s-]*(?:reached|exhaust)|check your plan|authentication|unauthorized|validation/.test(classificationText)) {
    return undefined
  }
  if (!isExplicitlyRateLimited(status, category, code)) return undefined
  // Ambiguous HTTP statuses (e.g. 503 with rate-limit prose) must not redispatch paid work.
  // Only definite admission rejections (425/429) or status-less structured
  // rejected-and-retryable concurrency signals qualify.
  if (typeof status === 'number' && status !== 425 && status !== 429) {
    return undefined
  }

  const headers = normalizeRetryHeaders(getErrorHeaders(error) ?? readNestedErrorValue(error, 'headers'))
  const retryAfterMs = parseRetryAfterMs(headers)
  return {
    reason: typeof category === 'string' ? category : 'rate-limit',
    ...(typeof status === 'number' ? { status } : {}),
    ...(typeof retryAfterMs === 'number' ? { retryAfterMs } : {})
  }
}
