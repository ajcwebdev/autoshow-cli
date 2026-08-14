import type { HostedOcrSchedulerRetryPressureHandler, OcrCreateRetryOptions, OcrPageRequestRetryOptions, RetryClassifier, RetryDecision, RetryPolicy } from '~/types'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { OCR_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'
import { classifyOcrErrorForRetry } from './ocr-failure-classifier'

export const OCR_SCHEMA_RETRY_ATTEMPTS = 3
export const OCR_PAGE_REQUEST_ATTEMPTS = 2
export const OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS = 6
export const OCR_PAGE_REQUEST_TIMEOUT_MS = 5 * 60_000
export const OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS = 2_000
export const OCR_RATE_LIMIT_RETRY_DELAY_MAX_MS = 30_000

export const OCR_CREATE_RETRY_POLICY: Partial<RetryPolicy> = {
  maxAttempts: 4,
  baseDelayMs: 2_000,
  maxDelayMs: 60_000,
  jitter: true,
  exponential: true
}

export const OCR_PAGE_REQUEST_RETRY_POLICY: Partial<RetryPolicy> = {
  maxAttempts: OCR_PAGE_REQUEST_ATTEMPTS,
  baseDelayMs: 2_000,
  maxDelayMs: 10_000,
  jitter: true,
  exponential: true
}

const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return true
  }
  if (error instanceof Error) {
    return error.name === 'TimeoutError' || /timed out|timeout/i.test(error.message)
  }
  return false
}

const isStructuredOcrResponseError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.name === 'OcrStructuredResponseError'
      || /not valid json|malformed json|schema|returned \d+ pages|non-contiguous page numbers|returned no pages|returned no text output/i.test(error.message)
  }
  return false
}

const getStatusFromError = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status
    if (typeof status === 'number') {
      return status
    }
  }
  return undefined
}

const getHeadersFromError = (error: unknown): Headers | undefined => {
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as { headers: unknown }).headers
    if (headers instanceof Headers) {
      return headers
    }
  }
  return undefined
}

const withOcrRateLimitRetryDelay = (error: unknown, decision: RetryDecision): RetryDecision => {
  if (!decision.shouldRetry || getStatusFromError(error) !== 429) {
    return decision
  }

  const retryAfterMs = parseRetryAfterMs(getHeadersFromError(error))
  if (typeof retryAfterMs === 'number') {
    return { ...decision, delayMs: retryAfterMs }
  }

  return { ...decision, delayMs: Math.max(decision.delayMs, OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS) }
}

export const classifyOcrCreateRetry = (error: unknown): RetryDecision => {
  if (isTimeoutError(error)) {
    return { shouldRetry: true, delayMs: 0, reason: 'timeout' }
  }
  const failure = classifyOcrErrorForRetry(error)
  if (failure.retryable === false) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: failure.blockedReason ?? `non-retryable ${failure.failureKind}`
    }
  }
  return withOcrRateLimitRetryDelay(
    error,
    classifyFetchRetry(error, 'runtime_http_create_retriable')
  )
}

const classifyOcrPageRequestRetry = (error: unknown): RetryDecision => {
  if (isStructuredOcrResponseError(error)) {
    return { shouldRetry: true, delayMs: 0, reason: 'structured_response' }
  }
  return classifyOcrCreateRetry(error)
}

const notifyRetryablePressure = (
  onRetryable: HostedOcrSchedulerRetryPressureHandler | undefined,
  error: unknown,
  decision: RetryDecision
): void | boolean | Promise<void | boolean> => {
  if (!decision.shouldRetry) {
    return
  }

  const retryAfterMs = parseRetryAfterMs(getHeadersFromError(error))
  const status = getStatusFromError(error)
  return onRetryable?.({
    reason: decision.reason,
    ...(decision.delayMs > 0 ? { delayMs: decision.delayMs } : {}),
    ...(typeof status === 'number' ? { status } : {}),
    ...(typeof retryAfterMs === 'number' ? { retryAfterMs } : {})
  }, error)
}

const withOcrRateLimitDelayClassifier = (
  classifier: RetryClassifier
): RetryClassifier => (error) => withOcrRateLimitRetryDelay(error, classifier(error))

const resolveCreateRetryOptions = (
  classifierOrOptions: RetryClassifier | OcrCreateRetryOptions | undefined
): OcrCreateRetryOptions =>
  typeof classifierOrOptions === 'function'
    ? { classifier: classifierOrOptions }
    : classifierOrOptions ?? {}

export const withOcrCreateRetry = async <T>(
  operationName: string,
  operation: (signal?: AbortSignal) => Promise<T>,
  classifierOrOptions?: RetryClassifier | OcrCreateRetryOptions
): Promise<T> => {
  const options = resolveCreateRetryOptions(classifierOrOptions)
  return await withRetry(
    {
      retryClass: 'runtime_http_create_retriable',
      operationName,
      policy: OCR_CREATE_RETRY_POLICY,
      timeoutMs: OCR_REQUEST_TIMEOUT_MS,
      onRetryAttempt: (error, decision) => notifyRetryablePressure(options.onRetryable, error, decision),
      retryHookCanExtendAttempts: options.onRetryable?.managesHostedRateLimitRecovery === true
    },
    operation,
    withOcrRateLimitDelayClassifier(options.classifier ?? classifyOcrCreateRetry)
  )
}

export const withOcrPageRequestRetry = async <T>(
  operationName: string,
  operation: (signal?: AbortSignal) => Promise<T>,
  options: OcrPageRequestRetryOptions = {}
): Promise<T> =>
  await withRetry(
    {
      retryClass: 'runtime_http_create_retriable',
      operationName,
      policy: {
        ...OCR_PAGE_REQUEST_RETRY_POLICY,
        ...(typeof options.attempts === 'number' ? { maxAttempts: Math.max(1, Math.floor(options.attempts)) } : {})
      },
      timeoutMs: options.timeoutMs ?? OCR_PAGE_REQUEST_TIMEOUT_MS,
      onRetryAttempt: (error, decision) => notifyRetryablePressure(options.onRetryable, error, decision),
      retryHookCanExtendAttempts: options.onRetryable?.managesHostedRateLimitRecovery === true,
      ...(options.attempts === undefined
        ? { rateLimitMaxAttempts: OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS }
        : {})
    },
    operation,
    withOcrRateLimitDelayClassifier(options.classifier ?? classifyOcrPageRequestRetry)
  )
