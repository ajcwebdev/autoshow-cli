import type { LaneState, ProviderLaneCompletionStatus, TokenState } from '~/types'

export const resolveHostedReleaseOutcome = (
  token: Pick<TokenState, 'pressureReported' | 'recoveryRetryApproved' | 'recoveryFailureRecorded'>,
  recoveryProbe: boolean,
  status: ProviderLaneCompletionStatus
) => {
  const failedPressure = token.pressureReported && status !== 'succeeded' && !token.recoveryRetryApproved
  const failedProbe = recoveryProbe && !token.pressureReported && status !== 'succeeded'
  return {
    clearProbe: token.pressureReported || recoveryProbe,
    discardRecovery: failedPressure || failedProbe,
    recordFailure: (failedPressure && !token.recoveryFailureRecorded) || failedProbe,
    finishRecovery: status === 'succeeded' && (recoveryProbe || token.pressureReported)
  }
}

export const selectHostedLaneWaiter = (
  lane: Readonly<LaneState>,
  recoveryKeys: ReadonlyMap<string, unknown>
): number => {
  if (lane.active >= lane.currentLimit || (lane.recovering && lane.recoveryProbeActive)) return -1
  return lane.waiters.findIndex(waiter =>
    waiter.classState.active < waiter.classState.configuredLimit
    && (!lane.recovering || recoveryKeys.has(waiter.recoveryKey))
  )
}

type HostedRampDecision =
  | { kind: 'idle' | 'unchanged' }
  | { kind: 'wake', atMs: number }
  | { kind: 'ramp', limit: number, nextRampAtMs: number | undefined, rampingAfterRecovery: boolean, reason: 'recovery-ramp' | 'startup-ramp' }

export const resolveHostedLaneRamp = (
  lane: Readonly<LaneState>,
  now: number,
  intervalMs: number
): HostedRampDecision => {
  if (lane.waiters.length === 0) return { kind: 'idle' }
  if (lane.recovering || lane.currentLimit >= lane.configuredLimit) return { kind: 'unchanged' }
  const atMs = lane.nextRampAtMs ?? now + intervalMs
  if (atMs > now) return { kind: 'wake', atMs }
  const limit = Math.min(lane.configuredLimit, lane.currentLimit + 1)
  const reachedCap = limit >= lane.configuredLimit
  return {
    kind: 'ramp',
    limit,
    nextRampAtMs: reachedCap ? undefined : now + intervalMs,
    rampingAfterRecovery: !reachedCap && lane.rampingAfterRecovery,
    reason: lane.rampingAfterRecovery ? 'recovery-ramp' : 'startup-ramp'
  }
}
