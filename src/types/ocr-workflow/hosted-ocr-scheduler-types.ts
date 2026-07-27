import type { ProviderCompletionStatus } from '~/types'

export type HostedOcrProfileStore<TVersion extends number, TProfile> = {
  version: TVersion
  profiles: TProfile[]
}

import type { HostedOcrService } from './hosted-ocr-types'

export type OcrConcurrencyMode = 'auto' | 'fixed'

export type PersistHostedOcrProfilesOptions = {
  completionStatus: ProviderCompletionStatus
  profilePath?: string | undefined
  now?: Date | undefined
}

export type HostedOcrSchedulerRetryPressure = {
  reason: string
  delayMs?: number | undefined
  status?: number | undefined
  retryAfterMs?: number | undefined
}

export type HostedOcrSchedulerRetryPressureHandler = (pressure: HostedOcrSchedulerRetryPressure) => void

export type HostedOcrSchedulerStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'incomplete'
  | 'failed'

export type HostedOcrSchedulerCapSource = 'fixed' | 'unprofiled' | 'profile'

export type HostedOcrSchedulerProfileConfidence = 'none' | 'sparse' | 'healthy'

export type HostedOcrSchedulerRetryEvent = {
  reason: string
  targetKey?: string | undefined
  pageNumber?: number | undefined
  delayMs?: number | undefined
  status?: number | undefined
  retryAfterMs?: number | undefined
  effectiveCap: number
}

export type HostedOcrSchedulerAdmission = {
  service: HostedOcrService
  model: string
  targetKey?: string | undefined
  pageNumber?: number | undefined
  pageCount?: number | undefined
  laneKey?: string | undefined
  scopeLabel?: string | undefined
}

export type HostedOcrSchedulerRunControls = {
  onRetryable: HostedOcrSchedulerRetryPressureHandler
}

export type HostedOcrSchedulerTargetTelemetry = {
  targetKey: string
  service: HostedOcrService
  model: string
  status: HostedOcrSchedulerStatus
  submittedPages: number
  completedPages: number
  failedPages: number
  share: number
  pagesPerMinute: number | null
  observedDurationMs?: number | undefined
  projectedObservedDurationMs?: number | undefined
}

export type HostedOcrSchedulerLaneTelemetry = {
  laneKey: string
  service: HostedOcrService
  scopeLabel: string
  status: HostedOcrSchedulerStatus
  mode: OcrConcurrencyMode
  initialCap: number
  currentCap: number
  maxCap: number
  capSource?: HostedOcrSchedulerCapSource | undefined
  sourceConfidence?: HostedOcrSchedulerProfileConfidence | undefined
  profileSampleCount?: number | undefined
  profileRaisedMaxCap?: number | undefined
  profileDisqualificationReason?: string | undefined
  activePeak: number
  retryPressureCount: number
  retryEvents?: HostedOcrSchedulerRetryEvent[] | undefined
  pauseTimeMs: number
  submittedPages: number
  completedPages: number
  failedPages: number
  pagesPerMinute: number | null
  observedDurationMs?: number | undefined
  projectedObservedDurationMs?: number | undefined
  targets: HostedOcrSchedulerTargetTelemetry[]
}

export type HostedOcrSchedulerGatingTarget = {
  laneKey: string
  targetKey: string
  service: HostedOcrService
  model: string
  status: HostedOcrSchedulerStatus
  submittedPages: number
  completedPages: number
  failedPages: number
  share: number
  pagesPerMinute: number | null
  observedDurationMs?: number | undefined
  projectedObservedDurationMs?: number | undefined
}

export type HostedOcrSchedulerTelemetry = {
  version: 1
  mode: OcrConcurrencyMode
  fixedCap?: number | undefined
  documentPages: number
  lanes: HostedOcrSchedulerLaneTelemetry[]
  likelyGatingTarget?: HostedOcrSchedulerGatingTarget | undefined
}

export type HostedOcrScheduler = {
  run: <T>(
    admission: HostedOcrSchedulerAdmission,
    task: (controls: HostedOcrSchedulerRunControls) => Promise<T>
  ) => Promise<T>
  snapshot: () => HostedOcrSchedulerTelemetry
  getMaxConcurrency: (admission: HostedOcrSchedulerAdmission) => number
  recordRetryPressure: (
    admission: HostedOcrSchedulerAdmission,
    pressure: HostedOcrSchedulerRetryPressure
  ) => void
}

export type HostedOcrSchedulerOptions = {
  mode: OcrConcurrencyMode
  pageCount: number
  fixedCap?: number | undefined
  profilePath?: string | undefined
}

export type QueuedHostedOcrJob<T = unknown> = {
  admission: Required<Pick<HostedOcrSchedulerAdmission, 'service' | 'model'>> & HostedOcrSchedulerAdmission
  targetKey: string
  pageCount: number
  task: (controls: HostedOcrSchedulerRunControls) => Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

export type HostedOcrSchedulerTargetStats = {
  targetKey: string
  service: HostedOcrService
  model: string
  submittedPages: number
  completedPages: number
  failedPages: number
  startedAtMs?: number | undefined
  finishedAtMs?: number | undefined
}

export type HostedOcrSchedulerLaneState = {
  laneKey: string
  service: HostedOcrService
  scopeLabel: string
  mode: OcrConcurrencyMode
  initialCap: number
  currentCap: number
  maxCap: number
  capSource: HostedOcrSchedulerCapSource
  sourceConfidence: HostedOcrSchedulerProfileConfidence
  profileSampleCount?: number | undefined
  profileRaisedMaxCap?: number | undefined
  profileDisqualificationReason?: string | undefined
  active: number
  activePeak: number
  cleanSuccessPages: number
  cleanFastRampEnabled: boolean
  retryPressureCount: number
  retryEvents: HostedOcrSchedulerRetryEvent[]
  pauseUntilMs: number
  pauseTimeMs: number
  submittedPages: number
  completedPages: number
  failedPages: number
  startedAtMs?: number | undefined
  finishedAtMs?: number | undefined
  targetOrder: string[]
  roundRobinCursor: number
  queues: Map<string, QueuedHostedOcrJob[]>
  targets: Map<string, HostedOcrSchedulerTargetStats>
  pumpTimer?: ReturnType<typeof setTimeout> | undefined
}
