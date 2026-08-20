import type { HostedOcrSchedulerRetryPressureHandler, OcrCreateRetryOptions, OcrPageRequestRetryOptions, RetryClassifier, RetryDecision, RetryPolicy } from '~/types'
import { classifyFetchRetry, getRetryPolicyForClass, isTimeoutError, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { findOcrStructuredResponseError } from '../ocr-structured-response-error'
import { OCR_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'
import { classifyOcrErrorForRetry } from './ocr-failure-classifier'

export const OCR_SCHEMA_RETRY_ATTEMPTS = 3
export const OCR_PAGE_REQUEST_ATTEMPTS = 2
export const OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS = 6
export const OCR_PAGE_REQUEST_TIMEOUT_MS = 5 * 60_000
export const OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS = 2_000
export const OCR_RATE_LIMIT_RETRY_DELAY_MAX_MS = 30_000

/**
 * Both OCR policies are the shared retriable-create tier. They used to be separate
 * literals with their own ceilings (60s here against TTS's 30s and the class table's 10s
 * for the same rate-limited-create situation); the numbers now come from one table, and
 * only the deliberate difference — a page request gets fewer attempts, with a wider
 * budget reserved for 429s — is restated.
 */
export const OCR_CREATE_RETRY_POLICY: RetryPolicy = getRetryPolicyForClass('runtime_http_create_retriable')

export const OCR_PAGE_REQUEST_RETRY_POLICY: RetryPolicy = {
  ...getRetryPolicyForClass('runtime_http_create_retriable'),
  maxAttempts: OCR_PAGE_REQUEST_ATTEMPTS
}

// Classification, not prose: every structured-response failure is an
// OcrStructuredResponseError, and the lookup walks the cause chain so a wrapped one still
// matches. This replaces a regex that matched messages this repo generates itself, which
// silently stopped classifying whenever any of that wording changed.
const isStructuredOcrResponseError = (error: unknown): boolean =>
  findOcrStructuredResponseError(error) !== undefined

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
      timeoutMs: OCR_REQUEST_TIMEOUT_MS,
      onRetryAttempt: (error, decision) => notifyRetryablePressure(options.onRetryable, error, decision),
      retryHookCanExtendAttempts: options.onRetryable?.managesHostedRateLimitRecovery === true
    },
    operation,
    withOcrRateLimitDelayClassifier(options.classifier ?? classifyOcrCreateRetry)
  )
}

/**
 * The one schema-retry loop for hosted OCR. Anthropic, Gemini and OpenAI each carried a
 * copy: same 3 attempts, three different levels of observability — Gemini logged
 * structured metadata and accumulated per-attempt billing, Anthropic logged a bare
 * message, and OpenAI retried paid requests completely silently.
 *
 * Only a failure of `parse` retries; anything thrown by `request` (including the create's
 * own exhausted retry) propagates untouched, exactly as the hand-rolled loops did. The
 * stacked paid-request ceiling — schema attempts × create attempts — is recorded on every
 * retry log so the real cost of a malformed-output storm is visible rather than implied.
 */
export const withOcrSchemaRetry = async <TResponse, TResult>(options: {
  operationName: string
  attempts?: number | undefined
  request: (attempt: number) => Promise<TResponse>
  parse: (response: TResponse, attempt: number) => TResult
  onSchemaFailure?: ((context: { error: unknown, response: TResponse, attempt: number }) => void) | undefined
  retryLogMetadata?: ((context: { error: unknown, response: TResponse, attempt: number }) => Record<string, unknown> | undefined) | undefined
}): Promise<TResult> => {
  const maxAttempts = Math.max(1, Math.floor(options.attempts ?? OCR_SCHEMA_RETRY_ATTEMPTS))
  const createAttempts = OCR_CREATE_RETRY_POLICY.maxAttempts ?? 1
  // Identity, not prose: the helper records which errors came out of `parse` so the
  // classifier never has to recognise a schema failure by its message.
  const schemaFailures = new WeakSet<object>()
  let attempt = 0
  let attemptLogMetadata: Record<string, unknown> | undefined

  return await withRetry(
    {
      retryClass: 'runtime_http_create_retriable',
      operationName: options.operationName,
      // A malformed response is re-requested immediately: the model may emit valid
      // output on the next pass, and no provider backoff applies to a 200 response.
      policy: { maxAttempts, baseDelayMs: 0, maxDelayMs: 0, jitter: false, exponential: false },
      retryLogMetadata: () => ({
        ocrSchemaAttempts: maxAttempts,
        ocrCreateAttempts: createAttempts,
        maxPaidRequests: maxAttempts * createAttempts,
        ...attemptLogMetadata
      })
    },
    async () => {
      attempt += 1
      const currentAttempt = attempt
      const response = await options.request(currentAttempt)
      try {
        return options.parse(response, currentAttempt)
      } catch (error) {
        if (error !== null && typeof error === 'object') {
          schemaFailures.add(error)
        }
        options.onSchemaFailure?.({ error, response, attempt: currentAttempt })
        attemptLogMetadata = options.retryLogMetadata?.({ error, response, attempt: currentAttempt })
        throw error
      }
    },
    (error) => error !== null && typeof error === 'object' && schemaFailures.has(error)
      ? { shouldRetry: true, delayMs: 0, reason: 'structured_response' }
      : { shouldRetry: false, delayMs: 0, reason: 'non-schema failure' }
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
