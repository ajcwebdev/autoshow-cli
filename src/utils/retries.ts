import type { HumanLogTable, PollOptions, RetryAttemptLog, RetryClass, RetryClassifier, RetryContext, RetryDecision, RetryPolicy } from '~/types'
import { AppError, extractErrorMetadata } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'

const NON_RETRYABLE_STATUSES = new Set([400, 401, 402, 403, 404, 422])
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const RUNTIME_HTTP_CREATE_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  baseDelayMs: 2_000,
  maxDelayMs: 10_000,
  jitter: true,
  exponential: true
}

const RETRY_POLICIES: Record<RetryClass, RetryPolicy> = {
  setup_download: {
    maxAttempts: 3,
    baseDelayMs: 2_000,
    maxDelayMs: 30_000,
    jitter: true,
    exponential: true
  },
  runtime_subprocess_transient: {
    maxAttempts: 2,
    baseDelayMs: 1_000,
    maxDelayMs: 5_000,
    jitter: false,
    exponential: false
  },
  runtime_local_inference: {
    maxAttempts: 3,
    baseDelayMs: 1_000,
    maxDelayMs: 8_000,
    jitter: true,
    exponential: true
  },
  runtime_http_read: {
    maxAttempts: 4,
    baseDelayMs: 1_000,
    maxDelayMs: 15_000,
    jitter: true,
    exponential: true
  },
  runtime_http_create_conservative: RUNTIME_HTTP_CREATE_RETRY_POLICY,
  runtime_http_create_retriable: RUNTIME_HTTP_CREATE_RETRY_POLICY,
  runtime_poll_loop: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    jitter: false,
    exponential: false
  }
} as const

export const isRetryableStatus = (status: number): boolean => {
  if (RETRYABLE_STATUSES.has(status)) return true
  return status >= 500
}

export const parseRetryAfterMs = (headers: Headers | undefined): number | undefined => {
  if (!headers) return undefined
  const value = headers.get('retry-after')
  if (!value) return undefined

  const seconds = Number(value)
  if (!Number.isNaN(seconds)) {
    return seconds * 1_000
  }

  const date = Date.parse(value)
  if (!Number.isNaN(date)) {
    const delayMs = date - Date.now()
    return delayMs > 0 ? delayMs : undefined
  }

  return undefined
}

const isNetworkError = (error: unknown): boolean => {
  if (error instanceof TypeError) return true
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('socket connection was closed unexpectedly') ||
      msg.includes('socket connection') ||
      msg.includes('socket hang up') ||
      msg.includes('closed unexpectedly') ||
      msg.includes('dns')
    )
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

const getStatusFromError = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status
    if (typeof status === 'number') return status
  }
  return undefined
}

const getRetryableFlagFromError = (error: unknown): boolean | undefined => {
  if (error && typeof error === 'object' && 'retryable' in error) {
    const retryable = (error as { retryable: unknown }).retryable
    if (typeof retryable === 'boolean') return retryable
  }
  return undefined
}

const getHeadersFromError = (error: unknown): Headers | undefined => {
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as { headers: unknown }).headers
    if (headers instanceof Headers) return headers
  }
  return undefined
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

/**
 * Retry a paid create request only when the provider definitely rejected it
 * before admitting work. Network failures, timeouts, 408/409 responses, and
 * 5xx responses are ambiguous and must be reconciled instead of redispatched.
 */
export const classifyPaidCreateRetry = (error: unknown): RetryDecision => {
  const metadata = extractErrorMetadata(error)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  if (status !== 425 && status !== 429) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: status === undefined
        ? 'paid create outcome is ambiguous'
        : `paid create status ${status} is not safe to redispatch`
    }
  }

  const headers = metadata['headers'] instanceof Headers ? metadata['headers'] : undefined
  return {
    shouldRetry: true,
    delayMs: parseRetryAfterMs(headers) ?? 0,
    reason: `provider rejected paid create with retryable status ${status}`
  }
}

export const classifyFetchRetry = (
  error: unknown,
  retryClass: RetryClass
): RetryDecision => {
  const noRetry = (reason: string): RetryDecision => ({ shouldRetry: false, delayMs: 0, reason })
  const doRetry = (delayMs: number, reason: string): RetryDecision => ({ shouldRetry: true, delayMs, reason })

  // The conservative paid-create rule had a byte-for-byte second copy here; it now defers
  // to the single implementation so the two cannot drift apart.
  if (retryClass === 'runtime_http_create_conservative') {
    return classifyPaidCreateRetry(error)
  }

  // An explicit retryable flag always wins: deterministic errors (e.g. a 200
  // response with a malformed/business-rejected body) mark themselves
  // non-retryable so the default retry-on-any-error behavior skips them.
  const explicitRetryable = getRetryableFlagFromError(error)
  if (explicitRetryable === false) {
    return noRetry('error marked non-retryable')
  }

  const status = getStatusFromError(error)

  if (status !== undefined) {
    if (NON_RETRYABLE_STATUSES.has(status)) {
      return noRetry(`non-retryable status ${status}`)
    }

    if (isRetryableStatus(status)) {
      const retryAfter = parseRetryAfterMs(getHeadersFromError(error))
      return doRetry(retryAfter ?? 0, `retryable status ${status}`)
    }

    return noRetry(`unexpected status ${status}`)
  }

  const retryCause = getWrappedRetryCause(error)

  if (isAbortError(retryCause) || isTimeoutError(retryCause)) {
    return doRetry(0, 'abort/timeout')
  }

  if (isNetworkError(retryCause)) {
    return doRetry(0, 'network error')
  }

  // Default: retry on the simple fact that a failure happened. Deterministic
  // client errors (4xx above) and side-effecting aborts are the only cases we
  // refuse to retry; any other unrecognized error is treated as transient.
  return doRetry(0, 'unclassified error')
}

const getRetryPolicy = (retryClass: RetryClass, overrides?: Partial<RetryPolicy>): RetryPolicy => {
  const base = RETRY_POLICIES[retryClass]
  if (!overrides) return base
  return { ...base, ...overrides }
}

const computeDelay = (attempt: number, baseDelayMs: number, maxDelayMs: number, exponential: boolean, jitter: boolean): number => {
  let delay = exponential
    ? baseDelayMs * Math.pow(2, attempt)
    : baseDelayMs

  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5)
  }

  return Math.min(delay, maxDelayMs)
}

const sleepWithAbortSignal = async (
  delayMs: number,
  signal?: AbortSignal | undefined
): Promise<void> => {
  signal?.throwIfAborted()
  if (!signal) {
    await Bun.sleep(delayMs)
    return
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const cleanup = (): void => {
      signal.removeEventListener('abort', onAbort)
    }
    const onAbort = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      cleanup()
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
    }
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }, delayMs)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
}

const resolveAttemptSignal = (
  timeoutMs: number | undefined,
  abortSignal: AbortSignal | undefined
): AbortSignal | undefined => {
  const timeoutSignal = typeof timeoutMs === 'number'
    ? AbortSignal.timeout(timeoutMs)
    : undefined
  if (timeoutSignal && abortSignal) {
    return AbortSignal.any([timeoutSignal, abortSignal])
  }
  return timeoutSignal ?? abortSignal
}

const toErrorCause = (error: unknown): Error => {
  if (error instanceof Error) {
    return error
  }
  return new Error(error === undefined ? 'Unknown retry failure' : String(error))
}

export const buildRetryAttemptTable = (
  summary: RetryAttemptLog
): HumanLogTable =>
  createKeyValueTable([
    ['operation', summary.operation],
    ['attempt', summary.attempt],
    ['maxAttempts', summary.maxAttempts],
    ['reason', summary.reason],
    ['delayMs', summary.delayMs]
  ])

const logRetryAttempt = (
  summary: RetryAttemptLog,
  metadata: Record<string, unknown> = {}
): void => {
  l.write('warn', 'Retry Attempt', {
    category: 'pipeline',
    humanTable: buildRetryAttemptTable(summary),
    metadata: {
      ...summary,
      ...metadata
    }
  })
}

export const withRetry = async <T>(
  ctx: RetryContext,
  operation: (signal?: AbortSignal) => Promise<T>,
  classifier?: RetryClassifier
): Promise<T> => {
  ctx.abortSignal?.throwIfAborted()
  const policy = getRetryPolicy(ctx.retryClass, ctx.policy)
  let maxAttempts = policy.maxAttempts
  const startedAt = Date.now()
  let lastError: unknown
  let retried = false
  let attemptsMade = 0
  let stopReason = 'max attempts reached'

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    ctx.abortSignal?.throwIfAborted()
    try {
      const signal = resolveAttemptSignal(ctx.timeoutMs, ctx.abortSignal)
      return await operation(signal)
    } catch (error) {
      ctx.abortSignal?.throwIfAborted()
      lastError = error
      attemptsMade = attempt + 1

      let classifiedReason: string | undefined
      if (classifier) {
        const decision = classifier(error)
        if (decision.shouldRetry && getStatusFromError(error) === 429 && typeof ctx.rateLimitMaxAttempts === 'number' && Number.isFinite(ctx.rateLimitMaxAttempts)) {
          maxAttempts = Math.max(maxAttempts, Math.max(1, Math.floor(ctx.rateLimitMaxAttempts)))
        }

        if (!decision.shouldRetry) {
          if (!retried) {
            throw error
          }
          stopReason = decision.reason
          break
        }

        const isLastAttempt = attempt >= maxAttempts - 1
        if (isLastAttempt && ctx.retryHookCanExtendAttempts !== true) {
          stopReason = 'max attempts reached'
          break
        }

        const retryDelayHandled = await ctx.onRetryAttempt?.(error, decision) === true

        if (retryDelayHandled) {
          retried = true
          maxAttempts = Math.max(maxAttempts, attempt + 2)
          continue
        }

        if (isLastAttempt) {
          stopReason = 'max attempts reached'
          break
        }

        if (decision.delayMs > 0) {
          retried = true
          logRetryAttempt({
            operation: ctx.operationName,
            attempt: attempt + 1,
            maxAttempts,
            reason: decision.reason,
            delayMs: decision.delayMs
          }, { retryClass: ctx.retryClass })
          await sleepWithAbortSignal(decision.delayMs, ctx.abortSignal)
          continue
        }

        classifiedReason = decision.reason
      } else if (attempt >= maxAttempts - 1) {
        stopReason = 'max attempts reached'
        break
      }

      retried = true
      const delay = computeDelay(attempt, policy.baseDelayMs, policy.maxDelayMs, policy.exponential, policy.jitter)
      const reason = classifiedReason ?? (error instanceof Error ? error.message : String(error))
      logRetryAttempt({
        operation: ctx.operationName,
        attempt: attempt + 1,
        maxAttempts,
        reason,
        delayMs: Math.round(delay)
      }, { retryClass: ctx.retryClass })
      await sleepWithAbortSignal(delay, ctx.abortSignal)
    }
  }

  const elapsed = Date.now() - startedAt
  const metadata = extractErrorMetadata(lastError)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const headers = metadata['headers'] instanceof Headers ? metadata['headers'] : undefined
  const stage = typeof metadata['stage'] === 'string' ? metadata['stage'] : undefined
  const retryable = typeof metadata['retryable'] === 'boolean' ? metadata['retryable'] : undefined
  const retryClass = typeof metadata['retryClass'] === 'string' ? metadata['retryClass'] as RetryClass : ctx.retryClass
  const enrichedMessage = `${ctx.operationName} failed after ${attemptsMade}/${maxAttempts} attempts (${stopReason}, ${elapsed}ms elapsed)`

  throw new AppError(enrichedMessage, {
    kind: 'retry_exhausted',
    cause: toErrorCause(lastError),
    retryClass,
    ...(typeof status === 'number' ? { status } : {}),
    ...(headers ? { headers } : {}),
    ...(stage ? { stage } : {}),
    ...(typeof retryable === 'boolean' ? { retryable } : {}),
    metadata: {
      ...metadata,
      attemptsMade,
      maxAttempts,
      elapsedMs: elapsed,
      stopReason,
      retryClass
    }
  })
}

export const pollUntil = async <T>(opts: PollOptions<T>): Promise<T> => {
  const deadline = Date.now() + opts.deadlineMs
  const { operationName, pollFn, isDone, isFailed, intervalMs, abortSignal } = opts

  while (Date.now() < deadline) {
    abortSignal?.throwIfAborted()
    const result = await pollFn()
    abortSignal?.throwIfAborted()

    if (isDone(result)) {
      return result
    }

    if (isFailed) {
      const failure = isFailed(result)
      if (failure.failed) {
        throw new AppError(`${operationName}: terminal failure — ${failure.reason}`, {
          kind: 'infrastructure',
          stage: operationName,
          metadata: { operationName, reason: failure.reason }
        })
      }
    }

    const remaining = deadline - Date.now()
    if (remaining <= 0) break

    await sleepWithAbortSignal(Math.min(intervalMs, remaining), abortSignal)
  }

  abortSignal?.throwIfAborted()
  throw new AppError(`${operationName}: deadline exceeded (${opts.deadlineMs}ms)`, {
    kind: 'retry_exhausted',
    stage: operationName,
    metadata: { operationName, deadlineMs: opts.deadlineMs }
  })
}
