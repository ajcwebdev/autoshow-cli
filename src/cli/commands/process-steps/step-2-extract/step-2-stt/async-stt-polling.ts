import { pollUntil } from '~/utils/retries'
import type { AsyncSttPoll, AsyncSttPollLoopOptions, PollStats, RetryClass } from '~/types'
import { annotateAppError, AppError, extractErrorMetadata, InfraError, isRetryExhaustedError } from '~/utils/error-handler'

export const DEFAULT_POLL_DEADLINE_MS = 10 * 60 * 1000

export const MAX_POLL_DEADLINE_MS = 30 * 60 * 1000

export const POLL_DEADLINE_AUDIO_MULTIPLIER_MS = 250

export const ASYNC_STT_RESUME_PROBE_DELAYS_MS = [0, 30_000, 60_000, 120_000, 240_000] as const

export const ASYNC_STT_RESUME_PROBE_REQUEST_BUDGET_MS = 5 * 60 * 1000

export const resolveAsyncSttPollDeadlineMs = (
  audioDurationSeconds: number | undefined
): number => {
  const durationScaled = typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds) && audioDurationSeconds > 0
    ? Math.round(audioDurationSeconds * POLL_DEADLINE_AUDIO_MULTIPLIER_MS)
    : 0

  return Math.min(
    MAX_POLL_DEADLINE_MS,
    Math.max(DEFAULT_POLL_DEADLINE_MS, durationScaled)
  )
}

export const pollAsyncSttJobUntilComplete = async <TStatus>(
  options: AsyncSttPollLoopOptions<TStatus>
): Promise<{ status: TStatus, pollCount: number, pollSleepMs: number }> => {
  const pollOnce = async (): Promise<AsyncSttPoll<TStatus>> => {
    const runPoll = async (): Promise<AsyncSttPoll<TStatus>> => await options.poll()
    const pollResult = options.withPollSlot
      ? await options.withPollSlot(runPoll)
      : await runPoll()
    await options.onProgress?.(pollResult.status)

    const failureReason = options.isFailed(pollResult.status)
    if (failureReason) {
      throw InfraError(failureReason, { stage: 'stt:async' })
    }

    return pollResult
  }

  const resumeProbe = options.pollMode === 'resume-probe'
  const totalProbeWaitMs = ASYNC_STT_RESUME_PROBE_DELAYS_MS.reduce<number>((sum, delayMs) => sum + delayMs, 0)
  const pollDeadlineMs = resumeProbe
    ? totalProbeWaitMs + ASYNC_STT_RESUME_PROBE_REQUEST_BUDGET_MS
    : resolveAsyncSttPollDeadlineMs(options.audioDurationSeconds)
  const stats: PollStats = { pollCount: 0, pollSleepMs: 0 }

  try {
    const pollResult = await pollUntil<AsyncSttPoll<TStatus>>({
      operationName: `async-stt-poll-${options.jobId}`,
      pollFn: pollOnce,
      isDone: (result) => options.isComplete(result.status),
      describeResult: (result) => ({
        jobId: options.jobId,
        ...(result.retryAfterMs !== null ? { retryAfterMs: result.retryAfterMs } : {})
      }),
      intervalMs: options.initialPollIntervalMs,
      maxIntervalMs: options.maxPollIntervalMs,
      deadlineMs: pollDeadlineMs,
      sleepBeforeFirstPoll: true,
      nextIntervalMs: (result) => result.retryAfterMs ?? undefined,
      ...(resumeProbe ? { intervalSchedule: ASYNC_STT_RESUME_PROBE_DELAYS_MS } : {}),
      stats
    })

    return {
      status: pollResult.status,
      pollCount: stats.pollCount,
      pollSleepMs: stats.pollSleepMs
    }
  } catch (error) {
    if (!isRetryExhaustedError(error)) {
      throw error
    }
    if (resumeProbe && options.buildResumeProbeError) {
      options.buildResumeProbeError(options.jobId, ASYNC_STT_RESUME_PROBE_DELAYS_MS.length, totalProbeWaitMs, error)
    }
    options.buildDeadlineError(options.jobId, resumeProbe ? totalProbeWaitMs : pollDeadlineMs, error)
  }
}

export const attachAsyncSttErrorContext = (
  error: unknown,
  stage: string,
  retryClass: RetryClass
): never => {
  throw annotateAppError(error, {
    kind: 'provider_http',
    stage,
    retryClass,
    metadata: { stage, retryClass }
  })
}

export const attachAsyncSttValidationContext = (
  error: unknown,
  stage: string,
  retryClass: RetryClass,
  rawResponse: unknown
): never => {
  throw annotateAppError(error, {
    kind: 'validation',
    stage,
    retryClass,
    retryable: false,
    metadata: { stage, retryClass, rawResponse }
  })
}

export const buildAsyncSttPollingDeadlineError = (
  provider: string,
  jobId: string,
  pollDeadlineMs: number,
  cause?: unknown
): never => {
  throw new AppError(
    `${provider} timed out waiting for transcription completion for ${jobId} (deadline exceeded after ${pollDeadlineMs}ms)`,
    {
      kind: 'retry_exhausted',
      stage: 'poll',
      retryClass: 'runtime_http_poll' satisfies RetryClass,
      retryable: false,
      ...(cause instanceof Error ? { cause } : {}),
      metadata: {
        provider,
        jobId,
        deadlineMs: pollDeadlineMs,
        stopReason: 'deadline exceeded',
        stopReasonCode: 'classifier_refused',
        ...extractErrorMetadata(cause)
      }
    }
  )
}

export const buildAsyncSttResumeProbeError = (
  provider: string,
  jobNoun: string,
  jobId: string,
  probeCount: number,
  totalWaitMs: number,
  cause?: unknown
): never => {
  throw new AppError(
    `${provider} ${jobNoun} ${jobId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`,
    {
      kind: 'retry_exhausted',
      stage: 'poll',
      retryClass: 'runtime_http_poll' satisfies RetryClass,
      retryable: false,
      ...(cause instanceof Error ? { cause } : {}),
      metadata: {
        provider,
        jobId,
        probeCount,
        totalWaitMs,
        stopReason: 'resume probes exhausted',
        stopReasonCode: 'max_attempts',
        ...extractErrorMetadata(cause)
      }
    }
  )
}
