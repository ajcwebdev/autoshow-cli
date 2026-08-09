import type { ClassifyFetchRetryOptions, RetryClass, RetryDecision, SttRequestMetrics, SttRetryMetrics } from '~/types'
import { classifyFetchRetry } from '~/utils/retries'
export const createSttRetryMetrics = (): SttRetryMetrics => ({
  retryCount: 0,
  rateLimitCount: 0
})

export const getSttErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

export const recordSttRetryMetric = (
  metrics: SttRetryMetrics,
  error: unknown,
  decision: RetryDecision
): void => {
  if (!decision.shouldRetry) {
    return
  }

  metrics.retryCount += 1
  if (getSttErrorStatus(error) === 429) {
    metrics.rateLimitCount += 1
  }
}

export const sttRetryMetricsToCallbacks = (
  metrics: SttRetryMetrics,
  onRequest: () => void
): SttRequestMetrics => ({
  onRequest,
  onRetry: (status) => {
    metrics.retryCount += 1
    if (status === 429) {
      metrics.rateLimitCount += 1
    }
  }
})

export const classifySttFetchRetryWithMetrics = (
  metrics: SttRetryMetrics,
  retryClass: RetryClass,
  options: ClassifyFetchRetryOptions = {}
) => (error: unknown): RetryDecision => {
  const decision = classifyFetchRetry(error, retryClass, options)
  recordSttRetryMetric(metrics, error, decision)
  return decision
}
