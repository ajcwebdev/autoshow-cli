import type { HostedTtsRetryOptions, RetryClassifier, RetryDecision, RetryPolicy } from '~/types'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const HOSTED_TTS_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 2_000,
  maxDelayMs: 30_000,
  jitter: true,
  exponential: true
}

export const classifyHostedTtsRetry: RetryClassifier = (error) =>
  classifyFetchRetry(error, 'runtime_http_create_retriable')

const getErrorStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status
    if (typeof status === 'number') return status
  }
  return undefined
}

const getErrorHeaders = (error: unknown): Headers | undefined => {
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as { headers: unknown }).headers
    if (headers instanceof Headers) return headers
  }
  return undefined
}

const notifyHostedTtsSchedulerRetry = (
  options: HostedTtsRetryOptions,
  error: unknown,
  decision: RetryDecision
): void => {
  if (!options.chunkScheduler || !options.ttsProvider) {
    return
  }

  const status = getErrorStatus(error)
  options.chunkScheduler.notifyRetry(options.ttsProvider, { status })

  if (status === 429) {
    options.chunkScheduler.notifyRateLimit(options.ttsProvider, {
      retryAfterMs: parseRetryAfterMs(getErrorHeaders(error)),
      delayMs: decision.delayMs
    })
  }
}

export const withHostedTtsRetry = async <T>(
  options: HostedTtsRetryOptions,
  operation: (signal?: AbortSignal) => Promise<T>
): Promise<T> =>
  await withRetry(
    {
      retryClass: 'runtime_http_create_retriable',
      operationName: options.operationName,
      timeoutMs: options.timeoutMs ?? MEDIA_GENERATION_TIMEOUT_MS,
      policy: {
        ...HOSTED_TTS_RETRY_POLICY,
        ...options.policy
      },
      onRetryAttempt: (error, decision) => notifyHostedTtsSchedulerRetry(options, error, decision)
    },
    operation,
    options.classifier ?? classifyHostedTtsRetry
  )
