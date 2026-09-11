import type { PollFailure, PollOptions } from '~/types'
import { AppError } from '~/utils/error-handler'
import { sleepWithAbortSignal } from './retry-abortable-delay'
import { formatRetryExhaustedMessage } from './retry-diagnostics'

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
