import type { HostedOcrSchedulerRetryPressureHandler, OcrCreateRetryOptions, OcrPageRequestRetryOptions, RetryClassifier, RetryDecision, RetryPolicy } from '~/types'
import { classifyFetchRetry, getRetryPolicyForClass, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { OCR_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'
import { classifyOcrErrorForRetry } from './ocr-failure-classifier'
import { getErrorHeaders, getErrorStatus, isAppError, ValidationError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'

export const OCR_SCHEMA_RETRY_ATTEMPTS = 3
export const OCR_PAGE_REQUEST_ATTEMPTS = 2
export const OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS = 6
export const OCR_PAGE_REQUEST_TIMEOUT_MS = 5 * 60_000

export const OCR_CREATE_RETRY_POLICY: RetryPolicy = getRetryPolicyForClass('runtime_http_create_conservative')
export const OCR_PAGE_REQUEST_RETRY_POLICY: RetryPolicy = getRetryPolicyForClass('runtime_http_create_conservative')

export const classifyOcrCreateRetry = (error: unknown): RetryDecision => {
  const failure = classifyOcrErrorForRetry(error)
  if (failure.retryable === false) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reasonCode: 'non_retryable_marked',
      reason: failure.blockedReason ?? `non-retryable ${failure.failureKind}`
    }
  }
  return classifyFetchRetry(error, 'runtime_http_create_conservative')
}

const notifyRetryablePressure = (
  onRetryable: HostedOcrSchedulerRetryPressureHandler | undefined,
  error: unknown,
  decision: RetryDecision
): void | boolean | Promise<void | boolean> => {
  if (!decision.shouldRetry) return
  const retryAfterMs = parseRetryAfterMs(getErrorHeaders(error))
  const status = getErrorStatus(error)
  return onRetryable?.({
    reason: decision.reason,
    ...(decision.delayMs > 0 ? { delayMs: decision.delayMs } : {}),
    ...(typeof status === 'number' ? { status } : {}),
    ...(typeof retryAfterMs === 'number' ? { retryAfterMs } : {})
  }, error)
}

const resolveCreateRetryOptions = (
  classifierOrOptions: RetryClassifier | OcrCreateRetryOptions | undefined
): OcrCreateRetryOptions => typeof classifierOrOptions === 'function'
  ? { classifier: classifierOrOptions }
  : classifierOrOptions ?? {}

export const withOcrCreateRetry = async <T>(
  operationName: string,
  operation: (signal?: AbortSignal) => Promise<T>,
  classifierOrOptions?: RetryClassifier | OcrCreateRetryOptions
): Promise<T> => {
  const options = resolveCreateRetryOptions(classifierOrOptions)
  return await withRetry({
    retryClass: 'runtime_http_create_conservative',
    operationName,
    timeoutMs: OCR_REQUEST_TIMEOUT_MS,
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
    onRetryAttempt: (error, decision) => notifyRetryablePressure(options.onRetryable, error, decision),
    retryHookCanExtendAttempts: options.onRetryable?.managesHostedRateLimitRecovery === true
  }, operation, options.classifier ?? classifyOcrCreateRetry)
}

export const runResponseReasks = async <TResponse, TResult>(options: {
  operationName: string
  attempts?: number | undefined
  request: (admittedResponse: number) => Promise<TResponse>
  parse: (response: TResponse, admittedResponse: number) => TResult
  onSchemaFailure?: ((context: { error: unknown, response: TResponse, attempt: number }) => void) | undefined
  retryLogMetadata?: ((context: { error: unknown, response: TResponse, attempt: number }) => Record<string, unknown> | undefined) | undefined
}): Promise<TResult> => {
  const maxAdmittedResponses = Math.max(1, Math.floor(options.attempts ?? OCR_SCHEMA_RETRY_ATTEMPTS))
  let lastError: unknown

  for (let admittedResponse = 1; admittedResponse <= maxAdmittedResponses; admittedResponse++) {
    const response = await options.request(admittedResponse)
    try {
      return options.parse(response, admittedResponse)
    } catch (error) {
      lastError = error
      options.onSchemaFailure?.({ error, response, attempt: admittedResponse })
      const evidence = options.retryLogMetadata?.({ error, response, attempt: admittedResponse })
      if (admittedResponse < maxAdmittedResponses) {
        l.warn(`Re-asking ${options.operationName} after invalid admitted response ${admittedResponse}/${maxAdmittedResponses}`, {
          category: 'retry',
          metadata: {
            operation: options.operationName,
            admittedResponse,
            maxAdmittedResponses,
            reasonCode: 'invalid_response_reask',
            ...evidence
          }
        })
        continue
      }
    }
  }

  const metadata = {
    operationName: options.operationName,
    admittedResponses: maxAdmittedResponses,
    maxAdmittedResponses,
    reaskExhausted: true
  }
  if (isAppError(lastError)) {
    Object.assign(lastError.metadata, metadata)
    throw lastError
  }
  throw ValidationError(`${options.operationName} returned ${maxAdmittedResponses} invalid admitted responses`, {
    stage: 'ocr:response-reask',
    cause: lastError,
    metadata
  })
}

export const withOcrSchemaRetry = runResponseReasks

export const withOcrPageRequestRetry = async <T>(
  operationName: string,
  operation: (signal?: AbortSignal) => Promise<T>,
  options: OcrPageRequestRetryOptions = {}
): Promise<T> => await withRetry({
  retryClass: 'runtime_http_create_conservative',
  operationName,
  timeoutMs: options.timeoutMs ?? OCR_PAGE_REQUEST_TIMEOUT_MS,
  ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
  onRetryAttempt: (error, decision) => notifyRetryablePressure(options.onRetryable, error, decision),
  retryHookCanExtendAttempts: options.onRetryable?.managesHostedRateLimitRecovery === true
}, operation, options.classifier ?? classifyOcrCreateRetry)
