import type { ProviderLanePressureFeedback, RecoveryState } from '~/types'
import { MAX_PROVIDER_RETRY_AFTER_MS } from '~/utils/retries'

const RATE_LIMIT_BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000] as const

export const resolveHostedRecoveryBackoff = (
  recovery: RecoveryState,
  feedback: ProviderLanePressureFeedback,
  now: number,
  recoveryBudgetMs: number,
  randomSample: number
): { delayMs: number, elapsedMs: number, remainingBudgetMs: number } => {
  const backoffIndex = Math.min(recovery.pressureAttempt - 1, RATE_LIMIT_BACKOFF_MS.length - 1)
  const baseDelayMs: number = RATE_LIMIT_BACKOFF_MS[backoffIndex] ?? 30_000
  const random = Math.min(1, Math.max(0, randomSample))
  // Cap the ladder base, then jitter (avoids jittering an already-capped value into a lower band inconsistently).
  const cappedBaseMs = Math.min(baseDelayMs, 30_000)
  const jitteredDelayMs = Math.round(cappedBaseMs * (0.5 + random * 0.5))
  // Provider Retry-After is already normalized/capped by classifyHostedRateLimitPressure via parseRetryAfterMs.
  const requestedDelayMs = Math.min(
    MAX_PROVIDER_RETRY_AFTER_MS,
    Math.max(0, feedback.delayMs ?? 0, feedback.retryAfterMs ?? 0)
  )
  // Hosted recovery keeps max(ladder, hint) so a short Retry-After cannot undercut the pressure ladder.
  const delayMs = Math.max(jitteredDelayMs, requestedDelayMs)
  const elapsedMs = Math.max(0, now - recovery.firstPressureAtMs)
  return {
    delayMs,
    elapsedMs,
    remainingBudgetMs: Math.max(0, recoveryBudgetMs - elapsedMs)
  }
}
