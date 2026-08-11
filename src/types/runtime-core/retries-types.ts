import type { RetryClass, RetryDecision, RetryPolicy } from '~/types'

export type RetryClassifier = (error: unknown) => RetryDecision

export type PollOptions<T> = {
  operationName: string
  pollFn: () => Promise<T>
  isDone: (result: T) => boolean
  isFailed?: (result: T) => { failed: true, reason: string } | { failed: false }
  intervalMs: number
  deadlineMs: number
  abortSignal?: AbortSignal | undefined
}

export type RetryContext = {
  retryClass: RetryClass
  operationName: string
  policy?: Partial<RetryPolicy>
  timeoutMs?: number
  abortSignal?: AbortSignal | undefined
  onRetryAttempt?: (error: unknown, decision: RetryDecision) => void
  rateLimitMaxAttempts?: number | undefined
}
