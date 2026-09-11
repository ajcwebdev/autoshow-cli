import type { ProviderLanePressureFeedback, RecoveryState } from '~/types'

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
  const jitteredDelayMs = Math.round(baseDelayMs * (0.5 + random * 0.5))
  const requestedDelayMs = Math.max(0, feedback.delayMs ?? 0, feedback.retryAfterMs ?? 0)
  const elapsedMs = Math.max(0, now - recovery.firstPressureAtMs)
  return {
    delayMs: Math.max(jitteredDelayMs, requestedDelayMs),
    elapsedMs,
    remainingBudgetMs: Math.max(0, recoveryBudgetMs - elapsedMs)
  }
}
