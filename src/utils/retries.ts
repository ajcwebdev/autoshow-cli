import type { RetryClassifier, RetryContext, RetryReasonCode } from '~/types'
import { classifyRetryFloor, decideRetryAttempt } from './retry-classification'
import { computeRetryDelay, getRetryPolicy, resolveRetryAttemptLimit } from './retry-policy'
import { resolveAttemptSignal, sleepWithAbortSignal } from './retry-abortable-delay'
import { buildRetryAttemptMetadata, logRetryAttempt, throwRetryExhausted } from './retry-diagnostics'

export { NON_RETRYABLE_STATUS_CODES, RETRYABLE_STATUS_CODES, NETWORK_FAILURE_SPELLINGS, NETWORK_FAILURE_CODES, MAX_PROVIDER_RETRY_AFTER_MS, isRetryableStatus, isNonRetryableStatus, parseRetryAfterMs, isAbortError, isTimeoutError, readRetrySignals, classifyPaidCreateRetry, classifyRetryFloor, classifyFetchRetry } from './retry-classification'
export { getRetryPolicyForClass } from './retry-policy'
export { sleepWithAbortSignal } from './retry-abortable-delay'
export { logRetryAttempt, formatRetryExhaustedMessage } from './retry-diagnostics'
export { pollUntil } from './retry-polling'

export const withRetry = async <T>(
  ctx: RetryContext,
  operation: (signal?: AbortSignal) => Promise<T>,
  classifier?: RetryClassifier
): Promise<T> => {
  ctx.abortSignal?.throwIfAborted()
  const policy = getRetryPolicy(ctx.retryClass, ctx.policy)
  const decide: RetryClassifier = classifier ?? classifyRetryFloor
  let maxAttempts = policy.maxAttempts
  const startedAt = Date.now()
  let lastError: unknown
  let retried = false
  let attemptsMade = 0
  let stopReason = 'max attempts reached'
  let stopReasonCode: RetryReasonCode = 'max_attempts'

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    ctx.abortSignal?.throwIfAborted()
    try {
      const signal = resolveAttemptSignal(ctx.timeoutMs, ctx.abortSignal)
      return await operation(signal)
    } catch (error) {
      ctx.abortSignal?.throwIfAborted()
      lastError = error
      attemptsMade = attempt + 1

      const { decision, signals } = decideRetryAttempt(error, decide)
      maxAttempts = resolveRetryAttemptLimit(maxAttempts, ctx, decision, signals)

      if (!decision.shouldRetry) {
        if (!retried) {
          throw error
        }
        stopReason = decision.reason
        stopReasonCode = decision.reasonCode ?? 'classifier_refused'
        break
      }

      const isLastAttempt = attempt >= maxAttempts - 1
      if (isLastAttempt && ctx.retryHookCanExtendAttempts !== true) {
        stopReason = 'max attempts reached'
        stopReasonCode = 'max_attempts'
        break
      }

      const retryDelayHandled = await ctx.onRetryAttempt?.(error, decision) === true
      const reasonCode = decision.reasonCode ?? 'unclassified_infrastructure'
      const attemptMetadata = buildRetryAttemptMetadata(ctx, error)

      if (retryDelayHandled) {
        retried = true
        maxAttempts = Math.max(maxAttempts, attempt + 2)
        logRetryAttempt({
          operation: ctx.operationName,
          failedAttempt: attempt + 1,
          nextAttempt: attempt + 2,
          maxAttempts,
          reason: decision.reason,
          reasonCode,
          delayMs: Math.max(0, Math.round(decision.delayMs))
        }, attemptMetadata)
        continue
      }

      if (isLastAttempt) {
        stopReason = 'max attempts reached'
        stopReasonCode = 'max_attempts'
        break
      }

      retried = true
      const delay = decision.delayMs > 0
        ? decision.delayMs
        : computeRetryDelay(attempt, policy.baseDelayMs, policy.maxDelayMs, policy.exponential, policy.jitter)
      logRetryAttempt({
        operation: ctx.operationName,
        failedAttempt: attempt + 1,
        nextAttempt: attempt + 2,
        maxAttempts,
        reason: decision.reason,
        reasonCode,
        delayMs: decision.delayMs > 0 ? delay : Math.round(delay)
      }, attemptMetadata)
      await sleepWithAbortSignal(delay, ctx.abortSignal)
    }
  }

  return throwRetryExhausted(ctx, lastError, { startedAt, attemptsMade, maxAttempts, stopReason, stopReasonCode })
}
