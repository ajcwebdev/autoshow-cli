import type { HostedOcrSchedulerAdmission, HostedOcrSchedulerCapSource, HostedOcrSchedulerProfileConfidence } from '~/types'

export type HostedOcrLaneCapResolution = {
  maxCap: number
  capSource: HostedOcrSchedulerCapSource
  sourceConfidence: HostedOcrSchedulerProfileConfidence
  profileSampleCount?: number | undefined
  profileRaisedMaxCap?: number | undefined
  profileDisqualificationReason?: string | undefined
}

export type HostedOcrRetryContext = {
  admission?: HostedOcrSchedulerAdmission | undefined
  targetKey?: string | undefined
}
