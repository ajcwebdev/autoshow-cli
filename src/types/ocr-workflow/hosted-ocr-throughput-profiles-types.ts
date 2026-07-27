import type { HostedOcrProfileStore, HostedOcrSchedulerProfileConfidence, OcrConcurrencyMode } from '~/types'

export type HostedOcrProfileCapSource = 'exact-clean-sample' | 'sparse-observation'
export type HostedOcrProfileDisqualificationReason =
  | 'retry-pressure'
  | 'paused'
  | 'partial'
  | 'failed'
  | 'incomplete'

export type HostedOcrThroughputProfile = {
  provider: string
  model: string
  scopeClass: string
  pageCountBand: string
  ocrConcurrencyMode: OcrConcurrencyMode
  laneTargetCount?: number | undefined
  throughputPagesPerMinute: number
  activePeak: number
  retryPressureCount: number
  pauseTimeMs: number
  completionStatus: 'full' | 'incomplete' | 'failed'
  firstSeenAt: string
  lastSeenAt: string
  sampleCount: number
  cleanSampleCount?: number | undefined
  raisedMaxCap?: number | undefined
  capSource?: HostedOcrProfileCapSource | undefined
  sourceConfidence?: HostedOcrSchedulerProfileConfidence | undefined
  disqualificationReason?: HostedOcrProfileDisqualificationReason | undefined
}

export type HostedOcrThroughputProfileStore = HostedOcrProfileStore<2, HostedOcrThroughputProfile>

export type HostedOcrProfileEstimate = {
  profile: HostedOcrThroughputProfile
  confidence: HostedOcrSchedulerProfileConfidence
}
