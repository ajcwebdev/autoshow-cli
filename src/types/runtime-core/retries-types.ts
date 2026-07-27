import type { RetryClass, RetryDecision, RetryPolicy } from '~/types'

export type ClassifyFetchRetryOptions = {
  retryAbortOnConservative?: boolean
}

export type RetryClassifier = (error: unknown) => RetryDecision

export type PollOptions<T> = {
  operationName: string
  pollFn: () => Promise<T>
  isDone: (result: T) => boolean
  isFailed?: (result: T) => { failed: true, reason: string } | { failed: false }
  intervalMs: number
  deadlineMs: number
}

export type RetryContext = {
  retryClass: RetryClass
  operationName: string
  policy?: Partial<RetryPolicy>
  timeoutMs?: number
  onRetryAttempt?: (error: unknown, decision: RetryDecision) => void
  maxAttemptsForRetry?: (
    error: unknown,
    decision: RetryDecision,
    attemptNumber: number,
    baseMaxAttempts: number
  ) => number | undefined
}
