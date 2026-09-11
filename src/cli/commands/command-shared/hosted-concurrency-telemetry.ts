import type { HostedConcurrencyClassTelemetry, HostedConcurrencyLaneTelemetry, LaneState } from '~/types'

export const projectHostedConcurrencyLane = (lane: LaneState, now: number): HostedConcurrencyLaneTelemetry => {
  const livePauseMs = lane.pauseStartedAtMs === undefined
    ? 0
    : Math.max(0, Math.min(now, lane.pauseUntilMs) - lane.pauseStartedAtMs)
  const classes: HostedConcurrencyClassTelemetry[] = [...lane.classes.entries()]
    .map(([workClass, state]) => ({
      workClass,
      configuredLimit: state.configuredLimit,
      active: state.active,
      activePeak: state.activePeak,
      queued: lane.waiters.filter((waiter) => waiter.admission.workClass === workClass).length
    }))
    .sort((left, right) => left.workClass.localeCompare(right.workClass))
  return {
    lane: lane.lane,
    configuredLimit: lane.configuredLimit,
    currentLimit: lane.currentLimit,
    active: lane.active,
    activePeak: lane.activePeak,
    queuedWork: lane.waiters.length,
    queuedPeak: lane.queuedPeak,
    admitted: lane.admitted,
    completed: lane.completed,
    failed: lane.failed,
    canceled: lane.canceled,
    rampTransitions: lane.rampTransitions.slice(),
    pressureEvents: lane.pressureEvents.slice(),
    pauseDurationMs: Math.round(lane.pauseDurationMs + livePauseMs),
    recoveryProbes: lane.recoveryProbes,
    recoveryFailures: lane.recoveryFailures,
    classes
  }
}
