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
  maxIntervalMs?: number | undefined
  intervalSchedule?: readonly number[] | undefined
  maxPolls?: number | undefined
  sleepBeforeFirstPoll?: boolean | undefined
  nextIntervalMs?: ((result: T, currentIntervalMs: number) => number | undefined) | undefined
  onPoll?: ((result: T, pollCount: number) => void | Promise<void>) | undefined
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
  retryLogMetadata?: ((error: unknown) => Record<string, unknown> | undefined) | undefined
}
