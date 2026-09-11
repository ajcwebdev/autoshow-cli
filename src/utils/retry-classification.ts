import type { RetryClass, RetryClassifier, RetryDecision, RetryReasonCode, RetrySignals } from '~/types'
import { AppError, extractErrorMetadata, isAppError, isRetryExhaustedError } from '~/utils/error-handler'

export const NON_RETRYABLE_STATUS_CODES = [400, 401, 402, 403, 404, 422] as const
export const RETRYABLE_STATUS_CODES = [408, 425, 429, 500, 502, 503, 504] as const
export const NETWORK_FAILURE_SPELLINGS = [
  'fetch failed',
  'network',
  'econnreset',
  'econnrefused',
  'etimedout',
  'socket connection was closed unexpectedly',
  'socket connection',
  'socket hang up',
  'closed unexpectedly',
  'dns'
] as const
export const NETWORK_FAILURE_CODES = [
  'ConnectionRefused',
  'ConnectionReset',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT'
] as const

export const MAX_PROVIDER_RETRY_AFTER_MS = 300_000

const NON_RETRYABLE_STATUSES: ReadonlySet<number> = new Set(NON_RETRYABLE_STATUS_CODES)
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set(RETRYABLE_STATUS_CODES)
const NETWORK_FAILURE_CODE_SET: ReadonlySet<string> = new Set(NETWORK_FAILURE_CODES)
const NETWORK_CAUSE_DEPTH_LIMIT = 6

export const isRetryableStatus = (status: number): boolean => {
  if (status === 501 || status === 505) return false
  if (RETRYABLE_STATUSES.has(status)) return true
  return status >= 500
}

export const isNonRetryableStatus = (status: number): boolean => NON_RETRYABLE_STATUSES.has(status)

export const parseRetryAfterMs = (headers: Headers | undefined): number | undefined => {
  if (!headers) return undefined
  const value = headers.get('retry-after')
  if (!value) return undefined

  const seconds = Number(value)
  if (Number.isFinite(seconds)) {
    const delayMs = seconds * 1_000
    return delayMs > 0 ? Math.min(delayMs, MAX_PROVIDER_RETRY_AFTER_MS) : undefined
  }

  const date = Date.parse(value)
  if (!Number.isNaN(date)) {
    const delayMs = date - Date.now()
    return delayMs > 0 ? Math.min(delayMs, MAX_PROVIDER_RETRY_AFTER_MS) : undefined
  }

  return undefined
}

const matchesNetworkSpelling = (message: string): boolean => {
  const msg = message.toLowerCase()
  return NETWORK_FAILURE_SPELLINGS.some((spelling) => msg.includes(spelling))
}

const boundedCauseChain = (error: unknown): object[] => {
  const chain: object[] = []
  const seen = new Set<unknown>()
  let current = error

  while (
    current !== null
    && typeof current === 'object'
    && !seen.has(current)
    && chain.length < NETWORK_CAUSE_DEPTH_LIMIT
  ) {
    chain.push(current)
    seen.add(current)
    current = 'cause' in current
      ? (current as { cause?: unknown }).cause
      : undefined
  }

  return chain
}

const isNetworkError = (error: unknown): boolean => {
  for (const entry of boundedCauseChain(error)) {
    const message = entry instanceof Error
      ? entry.message
      : 'message' in entry && typeof (entry as { message?: unknown }).message === 'string'
        ? (entry as { message: string }).message
        : ''
    const code = 'code' in entry ? (entry as { code?: unknown }).code : undefined
    if (matchesNetworkSpelling(message)) return true
    if (typeof code === 'string' && NETWORK_FAILURE_CODE_SET.has(code)) return true
  }
  return false
}

export const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof Error && error.name === 'AbortError') return true
  return false
}

export const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'TimeoutError') return true
  if (error instanceof Error) {
    return error.name === 'TimeoutError' || /timed out|timeout/i.test(error.message)
  }
  if (typeof error === 'string') {
    return /timed out|timeout/i.test(error)
  }
  if (error && typeof error === 'object') {
    const name = 'name' in error ? (error as { name: unknown }).name : undefined
    const message = 'message' in error ? (error as { message: unknown }).message : undefined
    return name === 'TimeoutError' || (typeof message === 'string' && /timed out|timeout/i.test(message))
  }
  return false
}

export const readRetrySignals = (error: unknown): RetrySignals => {
  const metadata = extractErrorMetadata(error)
  return {
    status: typeof metadata['status'] === 'number' ? metadata['status'] : undefined,
    retryable: typeof metadata['retryable'] === 'boolean' ? metadata['retryable'] : undefined,
    headers: metadata['headers'] instanceof Headers ? metadata['headers'] : undefined
  }
}

export const decideRetryAttempt = (error: unknown, classify: RetryClassifier): { decision: RetryDecision, signals: RetrySignals } => {
  const signals = readRetrySignals(error)
  const classified = classify(error)
  if (signals.retryable === false) {
    return { signals, decision: { shouldRetry: false, delayMs: 0, reason: 'error is explicitly non-retryable', reasonCode: 'non_retryable_marked' } }
  }
  if (isRetryExhaustedError(error)) {
    return { signals, decision: { shouldRetry: false, delayMs: 0, reason: 'nested retry exhaustion is terminal', reasonCode: 'nested_exhaustion' } }
  }
  return { signals, decision: classified }
}

const getWrappedRetryCause = (error: unknown): unknown => {
  const seen = new Set<unknown>()
  let current = error

  while (
    current instanceof AppError
    && current.kind === 'retry_exhausted'
    && current.cause instanceof Error
    && !seen.has(current)
  ) {
    seen.add(current)
    current = current.cause
  }

  return current
}

export const classifyPaidCreateRetry = (error: unknown): RetryDecision => {
  const { status, retryable, headers } = readRetrySignals(error)
  if (retryable === false) {
    return { shouldRetry: false, delayMs: 0, reasonCode: 'non_retryable_marked', reason: 'error marked non-retryable' }
  }
  if (isRetryExhaustedError(error)) {
    return { shouldRetry: false, delayMs: 0, reasonCode: 'nested_exhaustion', reason: 'nested retry or polling exhaustion' }
  }
  if (isAbortError(error) || isTimeoutError(error) || isNetworkError(error)) {
    return { shouldRetry: false, delayMs: 0, reasonCode: 'unsafe_paid_redispatch', reason: 'paid create outcome is ambiguous' }
  }
  const metadata = extractErrorMetadata(error)
  if (metadata['admissionDisposition'] === 'rejected' && retryable === true) {
    return {
      shouldRetry: true,
      delayMs: parseRetryAfterMs(headers) ?? 0,
      reasonCode: 'provider_rejected_admission',
      reason: 'provider explicitly rejected the admission as retryable'
    }
  }
  if (status !== 425 && status !== 429) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reasonCode: 'unsafe_paid_redispatch',
      reason: status === undefined
        ? 'paid create outcome is ambiguous'
        : `paid create status ${status} is not safe to redispatch`
    }
  }

  return {
    shouldRetry: true,
    delayMs: parseRetryAfterMs(headers) ?? 0,
    reasonCode: 'provider_rejected_admission',
    reason: `provider rejected paid create with retryable status ${status}`
  }
}

export const classifyRetryFloor = (error: unknown): RetryDecision => {
  const { status, retryable, headers } = readRetrySignals(error)

  if (retryable === false) {
    return { shouldRetry: false, delayMs: 0, reasonCode: 'non_retryable_marked', reason: 'error marked non-retryable' }
  }

  if (isRetryExhaustedError(error)) {
    return { shouldRetry: false, delayMs: 0, reasonCode: 'nested_exhaustion', reason: 'nested retry or polling exhaustion' }
  }

  if (status !== undefined && !isRetryableStatus(status)) {
    return { shouldRetry: false, delayMs: 0, reasonCode: 'non_retryable_status', reason: `non-retryable status ${status}` }
  }

  const reason = error instanceof Error ? error.message : String(error)
  if (status !== undefined && isRetryableStatus(status)) {
    return { shouldRetry: true, delayMs: parseRetryAfterMs(headers) ?? 0, reasonCode: 'retryable_status', reason: `retryable status ${status}` }
  }

  if (isAppError(error) && error.kind !== 'infrastructure' && error.kind !== 'provider_http') {
    return { shouldRetry: false, delayMs: 0, reasonCode: 'classifier_refused', reason: `${error.kind} failures are not transient` }
  }
  return { shouldRetry: true, delayMs: parseRetryAfterMs(headers) ?? 0, reasonCode: 'unclassified_infrastructure', reason }
}

export const classifyFetchRetry = (
  error: unknown,
  retryClass: RetryClass
): RetryDecision => {
  const noRetry = (reason: string, reasonCode: RetryReasonCode): RetryDecision => ({ shouldRetry: false, delayMs: 0, reason, reasonCode })
  const doRetry = (delayMs: number, reason: string, reasonCode: RetryReasonCode): RetryDecision => ({ shouldRetry: true, delayMs, reason, reasonCode })

  if (retryClass === 'runtime_http_create_conservative') {
    return classifyPaidCreateRetry(error)
  }

  const { status, retryable, headers } = readRetrySignals(error)

  if (retryable === false) {
    return noRetry('error marked non-retryable', 'non_retryable_marked')
  }

  if (isRetryExhaustedError(error)) {
    return noRetry('nested retry or polling exhaustion', 'nested_exhaustion')
  }

  if (status !== undefined) {
    if (NON_RETRYABLE_STATUSES.has(status)) {
      return noRetry(`non-retryable status ${status}`, 'non_retryable_status')
    }

    if (isRetryableStatus(status)) {
      return doRetry(parseRetryAfterMs(headers) ?? 0, `retryable status ${status}`, 'retryable_status')
    }

    return noRetry(`unexpected status ${status}`, 'non_retryable_status')
  }

  const retryCause = getWrappedRetryCause(error)

  if (isAbortError(retryCause) || isTimeoutError(retryCause)) {
    return doRetry(0, 'abort/timeout', 'timeout')
  }

  if (isNetworkError(retryCause)) {
    return doRetry(0, 'network error', 'network_error')
  }

  if (isAppError(retryCause) && retryCause.kind !== 'infrastructure' && retryCause.kind !== 'provider_http') {
    return noRetry(`${retryCause.kind} failures are not transient`, 'classifier_refused')
  }
  return doRetry(0, 'unclassified infrastructure error', 'unclassified_infrastructure')
}
