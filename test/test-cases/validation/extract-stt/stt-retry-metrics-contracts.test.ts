import { describe, expect, test } from 'bun:test'
import { ProviderError } from '~/utils/error-handler'
import {
  classifySttFetchRetryWithMetrics,
  createSttRetryMetrics,
  getSttErrorStatus,
  recordSttRetryMetric
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-retry-metrics'

describe('STT retry metrics contracts', () => {
  test('retry classifier records retry and rate-limit counts once per retry decision', () => {
    const metrics = createSttRetryMetrics()
    const error = ProviderError('rate limited', { status: 429, headers: new Headers() })
    const classify = classifySttFetchRetryWithMetrics(metrics, 'runtime_http_read')

    const decision = classify(error)

    expect(decision.shouldRetry).toBe(true)
    expect(getSttErrorStatus(error)).toBe(429)
    expect(metrics).toEqual({
      retryCount: 1,
      rateLimitCount: 1
    })
  })

  test('non-retry decisions do not increment metrics', () => {
    const metrics = createSttRetryMetrics()
    recordSttRetryMetric(metrics, ProviderError('bad request', { status: 400 }), {
      shouldRetry: false,
      delayMs: 0,
      reason: 'non-retryable status 400'
    })

    expect(metrics).toEqual({
      retryCount: 0,
      rateLimitCount: 0
    })
  })
})
