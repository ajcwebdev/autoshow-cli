import type { HostedOcrSchedulerLaneState, HostedOcrSchedulerSetTimer, HostedOcrSchedulerTargetStats, QueuedHostedOcrJob } from '~/types'

export type HostedOcrLaneJobStart = {
  target: HostedOcrSchedulerTargetStats
  documentTarget?: HostedOcrSchedulerTargetStats | undefined
}

export type HostedOcrLaneEngineOptions = {
  now: () => number
  setTimer: HostedOcrSchedulerSetTimer
  sharedHostedPolicy: boolean
  startJob: (
    lane: HostedOcrSchedulerLaneState,
    job: QueuedHostedOcrJob,
    transition: HostedOcrLaneJobStart
  ) => void
}
