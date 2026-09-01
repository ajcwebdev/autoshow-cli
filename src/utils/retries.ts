import type { HumanLogTable, PollFailure, PollOptions, RetryAttemptLog, RetryClass, RetryClassifier, RetryContext, RetryDecision, RetryPolicy, RetrySignals } from '~/types'
import { AppError, extractErrorMetadata } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'

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
  runtime_subprocess_transient: {
    maxAttempts: 2,
    baseDelayMs: 1_000,
    maxDelayMs: 5_000,
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

export const STT_POLL_RETRY_POLICY: Partial<RetryPolicy> = { maxAttempts: 6 }

export const getSttStageRetryPolicy = (retryClass: RetryClass): Partial<RetryPolicy> | undefined =>
  retryClass === 'runtime_http_read' ? STT_POLL_RETRY_POLICY : undefined

export const URL_ARTICLE_RETRY_POLICY: Partial<RetryPolicy> = {
  baseDelayMs: 2_000,
  maxDelayMs: 10_000,
  jitter: true,
  exponential: true
}

export const isRetryableStatus = (status: number): boolean => {
  if (RETRYABLE_STATUSES.has(status)) return true
  return status >= 500
}

export const isNonRetryableStatus = (status: number): boolean => NON_RETRYABLE_STATUSES.has(status)

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

const readRetrySignals = (error: unknown): RetrySignals => {
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
  const { status, headers } = readRetrySignals(error)
  if (status !== 425 && status !== 429) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: status === undefined
        ? 'paid create outcome is ambiguous'
        : `paid create status ${status} is not safe to redispatch`
    }
  }

  return {
    shouldRetry: true,
    delayMs: parseRetryAfterMs(headers) ?? 0,
    reason: `provider rejected paid create with retryable status ${status}`
  }
}

export const classifyRetryFloor = (error: unknown): RetryDecision => {
  const { status, retryable, headers } = readRetrySignals(error)

  if (retryable === false) {
    return { shouldRetry: false, delayMs: 0, reason: 'error marked non-retryable' }
  }

  if (status !== undefined && NON_RETRYABLE_STATUSES.has(status)) {
    return { shouldRetry: false, delayMs: 0, reason: `non-retryable status ${status}` }
  }

  const reason = error instanceof Error ? error.message : String(error)
  if (status !== undefined && isRetryableStatus(status)) {
    return { shouldRetry: true, delayMs: parseRetryAfterMs(headers) ?? 0, reason: `retryable status ${status}` }
  }

  return { shouldRetry: true, delayMs: parseRetryAfterMs(headers) ?? 0, reason }
}

export const classifyFetchRetry = (
  error: unknown,
  retryClass: RetryClass
): RetryDecision => {
  const noRetry = (reason: string): RetryDecision => ({ shouldRetry: false, delayMs: 0, reason })
  const doRetry = (delayMs: number, reason: string): RetryDecision => ({ shouldRetry: true, delayMs, reason })

  if (retryClass === 'runtime_http_create_conservative') {
    return classifyPaidCreateRetry(error)
  }

  const { status, retryable, headers } = readRetrySignals(error)

  if (retryable === false) {
    return noRetry('error marked non-retryable')
  }

  if (status !== undefined) {
    if (NON_RETRYABLE_STATUSES.has(status)) {
      return noRetry(`non-retryable status ${status}`)
    }

    if (isRetryableStatus(status)) {
      return doRetry(parseRetryAfterMs(headers) ?? 0, `retryable status ${status}`)
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

  return doRetry(0, 'unclassified error')
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

export const logRetryAttempt = (
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

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    ctx.abortSignal?.throwIfAborted()
    try {
      const signal = resolveAttemptSignal(ctx.timeoutMs, ctx.abortSignal)
      return await operation(signal)
    } catch (error) {
      ctx.abortSignal?.throwIfAborted()
      lastError = error
      attemptsMade = attempt + 1

      const decision = decide(error)
      if (decision.shouldRetry && readRetrySignals(error).status === 429 && typeof ctx.rateLimitMaxAttempts === 'number' && Number.isFinite(ctx.rateLimitMaxAttempts)) {
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
        }, { retryClass: ctx.retryClass, ...ctx.retryLogMetadata?.(error) })
        await sleepWithAbortSignal(decision.delayMs, ctx.abortSignal)
        continue
      }

      retried = true
      const delay = computeDelay(attempt, policy.baseDelayMs, policy.maxDelayMs, policy.exponential, policy.jitter)
      logRetryAttempt({
        operation: ctx.operationName,
        attempt: attempt + 1,
        maxAttempts,
        reason: decision.reason,
        delayMs: Math.round(delay)
      }, { retryClass: ctx.retryClass, ...ctx.retryLogMetadata?.(error) })
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

  throw new AppError(formatRetryExhaustedMessage(ctx.operationName, attemptsMade, maxAttempts, stopReason, elapsed), {
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
    metadata: {
      operationName,
      deadlineMs,
      attemptsMade: pollCount,
      maxAttempts,
      elapsedMs,
      stopReason,
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
