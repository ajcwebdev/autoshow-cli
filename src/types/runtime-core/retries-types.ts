import type { RetryClass, RetryDecision, RetryPolicy } from '~/types'

export type RetryClassifier = (error: unknown) => RetryDecision

export type RetrySignals = {
  status: number | undefined
  retryable: boolean | undefined
  headers: Headers | undefined
}

export type PollFailure =
  | {
    failed: true
    reason: string
    status?: number | undefined
    headers?: Headers | undefined
    metadata?: Record<string, unknown> | undefined
  }
  | { failed: false }

/**
 * Counters `pollUntil` fills in as it runs. Callers that report polling metrics
 * (async STT lifecycle metrics, for one) pass an object in and read it back
 * afterwards, which keeps `pollUntil`'s return type the plain poll result.
 */
export type PollStats = {
  pollCount: number
  pollSleepMs: number
}

export type PollOptions<T> = {
  operationName: string
  pollFn: () => Promise<T>
  isDone: (result: T) => boolean
  isFailed?: (result: T) => PollFailure
  intervalMs: number
  deadlineMs: number
  abortSignal?: AbortSignal | undefined
  /** Ceiling for the adaptive interval. Omit to keep `intervalMs` fixed. */
  maxIntervalMs?: number | undefined
  /**
   * Fixed ladder of delays to use instead of the adaptive interval. The poll
   * count is bounded by the ladder length, which is how a resume probe expresses
   * "check these five times, then give up".
   */
  intervalSchedule?: readonly number[] | undefined
  /** Hard cap on polls, independent of the deadline. */
  maxPolls?: number | undefined
  /** Wait one interval before the first poll instead of polling immediately. */
  sleepBeforeFirstPoll?: boolean | undefined
  /**
   * Chooses the next delay from the poll result — how a provider's `Retry-After`
   * paces the loop. Returning `undefined` keeps the adaptive progression.
   */
  nextIntervalMs?: ((result: T, currentIntervalMs: number) => number | undefined) | undefined
  onPoll?: ((result: T, pollCount: number) => void | Promise<void>) | undefined
  /** Snapshot of the last poll result recorded on the deadline error. */
  describeResult?: ((result: T) => Record<string, unknown> | undefined) | undefined
  stats?: PollStats | undefined
}

export type RetryContext = {
  retryClass: RetryClass
  operationName: string
  policy?: Partial<RetryPolicy>
  timeoutMs?: number
  abortSignal?: AbortSignal | undefined
  onRetryAttempt?: (error: unknown, decision: RetryDecision) => void | boolean | Promise<void | boolean>
  retryHookCanExtendAttempts?: boolean | undefined
  rateLimitMaxAttempts?: number | undefined
  /**
   * Extra fields to merge into the structured retry log for this attempt — how a caller
   * keeps provider-specific diagnostics (token counts, a sanitized schema-failure reason)
   * on the one central `Retry Attempt` record instead of emitting a second log line.
   */
  retryLogMetadata?: ((error: unknown) => Record<string, unknown> | undefined) | undefined
}
