import type { RetryClass, RetryContext, RetryDecision, RetryPolicy, RetrySignals } from '~/types'

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

export const resolveRetryAttemptLimit = (maxAttempts: number, ctx: RetryContext, decision: RetryDecision, signals: RetrySignals): number => {
  if (decision.shouldRetry && signals.status === 429 && typeof ctx.rateLimitMaxAttempts === 'number' && Number.isFinite(ctx.rateLimitMaxAttempts)) {
    return Math.max(maxAttempts, Math.max(1, Math.floor(ctx.rateLimitMaxAttempts)))
  }
  return maxAttempts
}

export const getRetryPolicy = (retryClass: RetryClass, overrides?: Partial<RetryPolicy>): RetryPolicy => {
  const base = RETRY_POLICIES[retryClass]
  if (!overrides) return { ...base }
  return { ...base, ...overrides }
}

export const computeRetryDelay = (attempt: number, baseDelayMs: number, maxDelayMs: number, exponential: boolean, jitter: boolean): number => {
  let delay = exponential
    ? baseDelayMs * Math.pow(2, attempt)
    : baseDelayMs

  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5)
  }

  return Math.min(delay, maxDelayMs)
}
