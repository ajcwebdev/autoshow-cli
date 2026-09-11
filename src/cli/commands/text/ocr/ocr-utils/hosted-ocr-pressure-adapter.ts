import type { HostedOcrRetryContext, HostedOcrSchedulerLaneState, HostedOcrSchedulerRetryPressure, QueuedHostedOcrJob } from '~/types'
import { buildHostedOcrRetryEvent, getHostedOcrErrorStatus, isHostedOcrTimeoutError, resolveHostedOcrBackoff, resolveHostedOcrRetryEvents, resolveHostedOcrRetryPause, resolveKimiHostedOcrProfileAfterPressure, shouldBackoffHostedOcrError } from './hosted-ocr-cap-policy'

export interface HostedOcrPressurePolicy {
  sharedHostedPolicy: boolean
  documentPages: number
  now: () => number
}

export const recordHostedOcrFailurePressure = (
  policy: HostedOcrPressurePolicy,
  lane: HostedOcrSchedulerLaneState,
  job: QueuedHostedOcrJob,
  error: unknown,
  retryPressureRecordedForJob: boolean
): void => {
  if (
    !shouldBackoffHostedOcrError(error)
    || retryPressureRecordedForJob
  ) {
    return
  }
  const status = getHostedOcrErrorStatus(error)
  recordHostedOcrLaneRetryPressure(policy,
    lane,
    {
      reason: isHostedOcrTimeoutError(error)
        ? 'timeout'
        : 'retryable-error',
      ...(typeof status === 'number' ? { status } : {})
    },
    {
      admission: job.admission,
      targetKey: job.targetKey
    }
  )
}

export const recordHostedOcrLaneRetryPressure = (
  policy: HostedOcrPressurePolicy,
  lane: HostedOcrSchedulerLaneState,
  pressure: HostedOcrSchedulerRetryPressure,
  context?: HostedOcrRetryContext | undefined
): void => {
  lane.retryPressureCount += 1
  if (!policy.sharedHostedPolicy) {
    Object.assign(lane, resolveHostedOcrBackoff(lane))
  }
  const kimiConstraint = resolveKimiHostedOcrProfileAfterPressure(
    lane,
    policy.documentPages
  )
  if (kimiConstraint) Object.assign(lane, kimiConstraint)
  recordHostedOcrLaneRetryEvent(lane, pressure, context)
  if (!policy.sharedHostedPolicy) {
    const pause = resolveHostedOcrRetryPause(
      lane.pauseUntilMs,
      pressure,
      policy.now()
    )
    lane.pauseUntilMs = pause.pauseUntilMs
    lane.pauseTimeMs += pause.addedPauseTimeMs
  }
}

export const recordHostedOcrLaneRetryEvent = (
  lane: HostedOcrSchedulerLaneState,
  pressure: HostedOcrSchedulerRetryPressure,
  context?: HostedOcrRetryContext | undefined
): void => {
  lane.retryEvents = resolveHostedOcrRetryEvents(
    lane.retryEvents,
    buildHostedOcrRetryEvent(lane, pressure, context)
  )
}
