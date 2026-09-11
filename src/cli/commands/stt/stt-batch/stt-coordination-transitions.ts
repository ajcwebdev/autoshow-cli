import type { ProviderFailureSummary, ProviderState, SttBatchBlockedProviderReason, SttTarget } from '~/types'

const MAX_PROVIDER_COOLDOWN_MS = 5 * 60 * 1000
const RETRYABLE_FAILURE_DEGRADE_THRESHOLD = 2

export const cloneBlockedReason = (
  reason: SttBatchBlockedProviderReason
): SttBatchBlockedProviderReason => ({
  service: reason.service,
  model: reason.model,
  local: reason.local,
  message: reason.message,
  retryable: reason.retryable,
  ...(reason.stage ? { stage: reason.stage } : {}),
  ...(typeof reason.status === 'number' ? { status: reason.status } : {}),
  ...(reason.degraded === true ? { degraded: true } : {})
})

const normalizeCooldownMs = (value: number | undefined): number | undefined => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return undefined
  }

  return Math.min(MAX_PROVIDER_COOLDOWN_MS, Math.round(value as number))
}

const buildDegradedReason = (
  target: SttTarget,
  failure: ProviderFailureSummary
): SttBatchBlockedProviderReason => {
  return {
    service: target.service,
    model: target.model,
    local: target.local,
    message: `Deferred remaining live-batch work after repeated failures: ${failure.message}`,
    retryable: true,
    ...(failure.stage ? { stage: failure.stage } : {}),
    ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
    degraded: true
}
}

export type SttProviderFailureOptions = {
  blockedReason?: SttBatchBlockedProviderReason | undefined
  cooldownMs?: number | undefined
}

export const resolveSttProviderFailure = (
  target: SttTarget,
  state: Readonly<ProviderState>,
  failure: ProviderFailureSummary,
  options: SttProviderFailureOptions,
  now: number
): Pick<ProviderState, 'blockedReason' | 'cooldownUntil' | 'consecutiveRetryableFailures' | 'stats'> => {
  const next = {
    blockedReason: state.blockedReason,
    cooldownUntil: state.cooldownUntil,
    consecutiveRetryableFailures: state.consecutiveRetryableFailures,
    stats: { ...state.stats }
  }
  if (options.blockedReason && !state.blockedReason) {
    next.blockedReason = cloneBlockedReason(options.blockedReason)
    next.cooldownUntil = undefined
    if (options.blockedReason.degraded) next.stats.degradedCount += 1
    else next.stats.blockedCount += 1
    return next
  }
  if (failure.retryable) {
    next.consecutiveRetryableFailures += 1
    if (next.consecutiveRetryableFailures >= RETRYABLE_FAILURE_DEGRADE_THRESHOLD && !next.blockedReason) {
      next.blockedReason = buildDegradedReason(target, failure)
      next.cooldownUntil = undefined
      next.stats.degradedCount += 1
      return next
    }
  } else {
    next.consecutiveRetryableFailures = 0
  }
  if (!next.blockedReason) {
    const cooldownMs = normalizeCooldownMs(options.cooldownMs)
    if (cooldownMs !== undefined) {
      next.cooldownUntil = Math.max(next.cooldownUntil ?? 0, now + cooldownMs)
    } else if (next.cooldownUntil !== undefined && next.cooldownUntil <= now) {
      next.cooldownUntil = undefined
    }
  }
  return next
}
