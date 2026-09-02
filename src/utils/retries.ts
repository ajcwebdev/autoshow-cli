import type { PollFailure, PollOptions, RetryAttemptLog, RetryClass, RetryClassifier, RetryContext, RetryDecision, RetryPolicy, RetryReasonCode, RetrySignals } from '~/types'
import { AppError, extractErrorMetadata, isAppError, isRetryExhaustedError, serializeDiagnosticError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'

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

const RETRY_POLICIES: Record<RetryClass, RetryPolicy> = {
  setup_download: {
    maxAttempts: 3,
    baseDelayMs: 2_000,
    maxDelayMs: 30_000,
    jitter: true,
    exponential: true
  },
  filesystem_visibility: {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 100,
    jitter: false,
    exponential: false
  },
  runtime_subprocess_transient: {
    maxAttempts: 2,
    baseDelayMs: 1_000,
    maxDelayMs: 1_000,
    jitter: false,
    exponential: false
  },
  runtime_http_read: {
    maxAttempts: 4,
    baseDelayMs: 1_000,
    maxDelayMs: 15_000,
    jitter: true,
    exponential: true
  },
  runtime_http_poll: {
    maxAttempts: 6,
    baseDelayMs: 1_000,
    maxDelayMs: 15_000,
    jitter: true,
    exponential: true
  },
  runtime_http_create_conservative: {
    maxAttempts: 2,
    baseDelayMs: 2_000,
    maxDelayMs: 30_000,
    jitter: true,
    exponential: true
  },
  runtime_http_create_retriable: {
    maxAttempts: 4,
    baseDelayMs: 2_000,
    maxDelayMs: 30_000,
    jitter: true,
    exponential: true
  }
}

export const getRetryPolicyForClass = (retryClass: RetryClass): RetryPolicy => ({ ...RETRY_POLICIES[retryClass] })

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

const getRetryPolicy = (retryClass: RetryClass, overrides?: Partial<RetryPolicy>): RetryPolicy => {
  const base = RETRY_POLICIES[retryClass]
  if (!overrides) return { ...base }
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

export const sleepWithAbortSignal = async (
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

export const logRetryAttempt = (
  summary: RetryAttemptLog,
  metadata: Record<string, unknown> = {}
): void => {
  l.write('warn', `Retrying ${summary.operation} in ${summary.delayMs}ms after attempt ${summary.failedAttempt}/${summary.maxAttempts}: ${summary.reason}`, {
    category: 'retry',
    metadata: {
      ...summary,
      ...metadata
    }
  })
}

export const formatRetryExhaustedMessage = (
  operationName: string,
  attemptsMade: number,
  maxAttempts: number,
  stopReason: string,
  elapsedMs: number
): string => `${operationName} failed after ${attemptsMade}/${maxAttempts} attempts (${stopReason}, ${elapsedMs}ms elapsed)`

export const withRetry = async <T>(
  ctx: RetryContext,
  operation: (signal?: AbortSignal) => Promise<T>,
  classifier?: RetryClassifier
): Promise<T> => {
  ctx.abortSignal?.throwIfAborted()
  const policy = getRetryPolicy(ctx.retryClass, ctx.policy)
  const decide: RetryClassifier = classifier ?? classifyRetryFloor
  let maxAttempts = policy.maxAttempts
  const startedAt = Date.now()
  let lastError: unknown
  let retried = false
  let attemptsMade = 0
  let stopReason = 'max attempts reached'
  let stopReasonCode: RetryReasonCode = 'max_attempts'

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    ctx.abortSignal?.throwIfAborted()
    try {
      const signal = resolveAttemptSignal(ctx.timeoutMs, ctx.abortSignal)
      return await operation(signal)
    } catch (error) {
      ctx.abortSignal?.throwIfAborted()
      lastError = error
      attemptsMade = attempt + 1

      const retrySignals = readRetrySignals(error)
      const classifiedDecision = decide(error)
      const decision: RetryDecision = retrySignals.retryable === false
        ? { shouldRetry: false, delayMs: 0, reason: 'error is explicitly non-retryable', reasonCode: 'non_retryable_marked' }
        : isRetryExhaustedError(error)
          ? { shouldRetry: false, delayMs: 0, reason: 'nested retry exhaustion is terminal', reasonCode: 'nested_exhaustion' }
          : classifiedDecision
      if (decision.shouldRetry && retrySignals.status === 429 && typeof ctx.rateLimitMaxAttempts === 'number' && Number.isFinite(ctx.rateLimitMaxAttempts)) {
        maxAttempts = Math.max(maxAttempts, Math.max(1, Math.floor(ctx.rateLimitMaxAttempts)))
      }

      if (!decision.shouldRetry) {
        if (!retried) {
          throw error
        }
        stopReason = decision.reason
        stopReasonCode = decision.reasonCode ?? 'classifier_refused'
        break
      }

      const isLastAttempt = attempt >= maxAttempts - 1
      if (isLastAttempt && ctx.retryHookCanExtendAttempts !== true) {
        stopReason = 'max attempts reached'
        stopReasonCode = 'max_attempts'
        break
      }

      const retryDelayHandled = await ctx.onRetryAttempt?.(error, decision) === true
      const reasonCode = decision.reasonCode ?? 'unclassified_infrastructure'
      const attemptMetadata = {
        retryClass: ctx.retryClass,
        stage: typeof extractErrorMetadata(error)['stage'] === 'string' ? extractErrorMetadata(error)['stage'] : ctx.operationName,
        status: readRetrySignals(error).status,
        cause: serializeDiagnosticError(error),
        ...ctx.retryLogMetadata?.(error)
      }

      if (retryDelayHandled) {
        retried = true
        maxAttempts = Math.max(maxAttempts, attempt + 2)
        logRetryAttempt({
          operation: ctx.operationName,
          failedAttempt: attempt + 1,
          nextAttempt: attempt + 2,
          maxAttempts,
          reason: decision.reason,
          reasonCode,
          delayMs: Math.max(0, Math.round(decision.delayMs))
        }, attemptMetadata)
        continue
      }

      if (isLastAttempt) {
        stopReason = 'max attempts reached'
        stopReasonCode = 'max_attempts'
        break
      }

      if (decision.delayMs > 0) {
        retried = true
        logRetryAttempt({
          operation: ctx.operationName,
          failedAttempt: attempt + 1,
          nextAttempt: attempt + 2,
          maxAttempts,
          reason: decision.reason,
          reasonCode,
          delayMs: decision.delayMs
        }, attemptMetadata)
        await sleepWithAbortSignal(decision.delayMs, ctx.abortSignal)
        continue
      }

      retried = true
      const delay = computeDelay(attempt, policy.baseDelayMs, policy.maxDelayMs, policy.exponential, policy.jitter)
      logRetryAttempt({
        operation: ctx.operationName,
        failedAttempt: attempt + 1,
        nextAttempt: attempt + 2,
        maxAttempts,
        reason: decision.reason,
        reasonCode,
        delayMs: Math.round(delay)
      }, attemptMetadata)
      await sleepWithAbortSignal(delay, ctx.abortSignal)
    }
  }

  const elapsed = Date.now() - startedAt
  const metadata = extractErrorMetadata(lastError)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const headers = metadata['headers'] instanceof Headers ? metadata['headers'] : undefined
  const stage = typeof metadata['stage'] === 'string' ? metadata['stage'] : undefined
  const retryable = typeof metadata['retryable'] === 'boolean' ? metadata['retryable'] : undefined
  const {
    status: _causeStatus,
    headers: _causeHeaders,
    stage: _causeStage,
    retryable: _causeRetryable,
    retryClass: _causeRetryClass,
    ...causeMetadata
  } = metadata

  throw new AppError(formatRetryExhaustedMessage(ctx.operationName, attemptsMade, maxAttempts, stopReason, elapsed), {
    kind: 'retry_exhausted',
    cause: lastError,
    retryClass: ctx.retryClass,
    ...(typeof status === 'number' ? { status } : {}),
    ...(headers ? { headers } : {}),
    stage: stage ?? ctx.operationName,
    retryable: false,
    metadata: {
      ...causeMetadata,
      attemptsMade,
      maxAttempts,
      elapsedMs: elapsed,
      stopReason,
      stopReasonCode,
      retryClass: ctx.retryClass,
      ...(typeof retryable === 'boolean' ? { causeRetryable: retryable } : {})
    }
  })
}

const resolveNextPollDelayMs = <T>(
  opts: PollOptions<T>,
  result: T,
  currentIntervalMs: number
): number => {
  const requested = opts.nextIntervalMs?.(result, currentIntervalMs)
  if (typeof requested === 'number' && Number.isFinite(requested)) {
    return Math.min(opts.maxIntervalMs ?? requested, Math.max(opts.intervalMs, requested))
  }
  if (typeof opts.maxIntervalMs !== 'number') {
    return currentIntervalMs
  }
  return Math.min(opts.maxIntervalMs, currentIntervalMs * 2)
}

const throwPollExhausted = (
  operationName: string,
  stopReason: string,
  pollCount: number,
  maxPolls: number | undefined,
  deadlineMs: number,
  elapsedMs: number,
  lastPoll: Record<string, unknown> | undefined
): never => {
  const maxAttempts = maxPolls ?? pollCount
  throw new AppError(formatRetryExhaustedMessage(operationName, pollCount, maxAttempts, stopReason, elapsedMs), {
    kind: 'retry_exhausted',
    stage: operationName,
    retryClass: 'runtime_http_poll',
    retryable: false,
    metadata: {
      operationName,
      deadlineMs,
      attemptsMade: pollCount,
      maxAttempts,
      elapsedMs,
      stopReason,
      stopReasonCode: stopReason === 'max polls reached' ? 'max_attempts' : 'classifier_refused',
      retryClass: 'runtime_http_poll',
      pollCount,
      ...(lastPoll ? { lastPoll } : {})
    }
  })
}

const throwPollTerminalFailure = (
  operationName: string,
  failure: Extract<PollFailure, { failed: true }>,
  pollCount: number,
  elapsedMs: number
): never => {
  throw new AppError(`${operationName}: terminal failure — ${failure.reason}`, {
    kind: 'infrastructure',
    stage: operationName,
    ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
    ...(failure.headers instanceof Headers ? { headers: failure.headers } : {}),
    metadata: {
      operationName,
      reason: failure.reason,
      pollCount,
      elapsedMs,
      ...(failure.metadata ?? {})
    }
  })
}

export const pollUntil = async <T>(opts: PollOptions<T>): Promise<T> => {
  const startedAt = Date.now()
  const deadline = startedAt + opts.deadlineMs
  const { operationName, pollFn, isDone, isFailed, abortSignal, intervalSchedule } = opts
  const maxPolls = intervalSchedule ? intervalSchedule.length : opts.maxPolls
  const stats = opts.stats

  let pollCount = 0
  let intervalMs = intervalSchedule ? (intervalSchedule[0] ?? 0) : opts.intervalMs
  let sleepBeforePoll = intervalSchedule !== undefined || opts.sleepBeforeFirstPoll === true
  let lastPoll: Record<string, unknown> | undefined

  while (true) {
    abortSignal?.throwIfAborted()

    if (sleepBeforePoll) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) break
      const delayMs = Math.min(intervalMs, remaining)
      if (delayMs > 0) {
        const sleepStartedAt = Date.now()
        await sleepWithAbortSignal(delayMs, abortSignal)
        if (stats) stats.pollSleepMs += Date.now() - sleepStartedAt
      }
    } else if (Date.now() >= deadline) {
      break
    }
    sleepBeforePoll = true

    abortSignal?.throwIfAborted()
    const result = await pollFn()
    abortSignal?.throwIfAborted()
    pollCount += 1
    if (stats) stats.pollCount += 1
    lastPoll = opts.describeResult?.(result) ?? lastPoll
    await opts.onPoll?.(result, pollCount)

    if (isDone(result)) {
      return result
    }

    if (isFailed) {
      const failure = isFailed(result)
      if (failure.failed) {
        throwPollTerminalFailure(operationName, failure, pollCount, Date.now() - startedAt)
      }
    }

    if (typeof maxPolls === 'number' && pollCount >= maxPolls) {
      throwPollExhausted(
        operationName,
        'max polls reached',
        pollCount,
        maxPolls,
        opts.deadlineMs,
        Date.now() - startedAt,
        lastPoll
      )
    }

    intervalMs = intervalSchedule
      ? (intervalSchedule[pollCount] ?? intervalMs)
      : resolveNextPollDelayMs(opts, result, intervalMs)
  }

  abortSignal?.throwIfAborted()
  return throwPollExhausted(
    operationName,
    'deadline exceeded',
    pollCount,
    maxPolls,
    opts.deadlineMs,
    Date.now() - startedAt,
    lastPoll
  )
}
