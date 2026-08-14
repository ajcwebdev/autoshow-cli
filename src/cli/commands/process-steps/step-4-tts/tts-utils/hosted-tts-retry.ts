import type { HostedTtsRetryAttemptContext, HostedTtsRetryOptions, RetryClassifier, RetryDecision, RetryPolicy } from '~/types'
import { AppError } from '~/utils/error-handler'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { classifyHostedRateLimitPressure } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'

const HOSTED_TTS_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 2_000,
  maxDelayMs: 30_000,
  jitter: true,
  exponential: true
}

export const classifyHostedTtsRetry: RetryClassifier = (error) => {
  const hostedPressure = classifyHostedRateLimitPressure(error)
  return error instanceof Error && (error as Error & { ttsAdmissionAmbiguous?: boolean }).ttsAdmissionAmbiguous === true
    ? { shouldRetry: false, delayMs: 0, reason: 'provider admission outcome is ambiguous' }
    : error instanceof AppError && (error.kind === 'usage' || error.kind === 'validation' || error.kind === 'internal')
      ? { shouldRetry: false, delayMs: 0, reason: `deterministic ${error.kind} error` }
      : hostedPressure
        ? { shouldRetry: true, delayMs: hostedPressure.retryAfterMs ?? hostedPressure.delayMs ?? 0, reason: hostedPressure.reason }
        : classifyFetchRetry(error, 'runtime_http_create_conservative')
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
): void | boolean | Promise<void | boolean> => {
  if (!options.chunkScheduler || !options.admission) {
    return
  }

  options.chunkScheduler.notifyRetry(options.admission)

  const pressure = classifyHostedRateLimitPressure(error)
  if (pressure) {
    return options.chunkScheduler.notifyRateLimit(options.admission, {
      ...pressure,
      retryAfterMs: pressure.retryAfterMs ?? parseRetryAfterMs(getErrorHeaders(error)),
      delayMs: Math.max(pressure.delayMs ?? 0, decision.delayMs)
    }, error)
  }
}

export const withHostedTtsRetry = async <T>(
  options: HostedTtsRetryOptions,
  operation: (signal: AbortSignal | undefined, attempt: HostedTtsRetryAttemptContext) => Promise<T>
): Promise<T> => {
  options.abortSignal?.throwIfAborted()
  const classifier = options.classifier ?? classifyHostedTtsRetry
  let attempt = 0
  let retryReasonCode: string | undefined
  return await withRetry(
    {
      retryClass: 'runtime_http_create_retriable',
      operationName: options.operationName,
      timeoutMs: options.timeoutMs ?? MEDIA_GENERATION_TIMEOUT_MS,
      abortSignal: options.abortSignal,
      policy: {
        ...HOSTED_TTS_RETRY_POLICY,
        ...options.policy
      },
      retryHookCanExtendAttempts: options.chunkScheduler?.usesSharedHostedRateLimitRecovery() === true,
      onRetryAttempt: (error, decision) => {
        retryReasonCode = decision.reason
        return notifyHostedTtsSchedulerRetry(options, error, decision)
      }
    },
    async (attemptSignal) => {
      const signals = [attemptSignal, options.abortSignal]
        .filter((signal): signal is AbortSignal => signal !== undefined)
      const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0]
      signal?.throwIfAborted()
      attempt += 1
      return await operation(signal, {
        attempt,
        ...(retryReasonCode ? { retryReasonCode } : {})
      })
    },
    error => options.abortSignal?.aborted
      ? { shouldRetry: false, delayMs: 0, reason: 'operation cancelled' }
      : classifier(error)
  )
}
