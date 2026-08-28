import type { RetryClass, RetryDecision, SttRequestMetrics, SttRetryMetrics } from '~/types'
import { classifyFetchRetry } from '~/utils/retries'
import { getErrorStatus } from '~/utils/error-handler'
export const createSttRetryMetrics = (): SttRetryMetrics => ({
  retryCount: 0,
  rateLimitCount: 0
})

export const recordSttRetryMetric = (
  metrics: SttRetryMetrics,
  error: unknown,
  decision: RetryDecision
): void => {
  if (!decision.shouldRetry) {
    return
  }

  metrics.retryCount += 1
  if (getErrorStatus(error) === 429) {
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
  retryClass: RetryClass
) => (error: unknown): RetryDecision => {
  const decision = classifyFetchRetry(error, retryClass)
  recordSttRetryMetric(metrics, error, decision)
  return decision
}
