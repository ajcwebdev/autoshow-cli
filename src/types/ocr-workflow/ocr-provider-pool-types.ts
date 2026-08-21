import type { Indexed, OcrTarget } from '~/types'

export type IndexedOcrTarget = Indexed<OcrTarget>

export type OcrProviderMode = 'fanout' | 'pool'

type OcrPoolAttemptStatus = 'running' | 'accepted' | 'failed' | 'ambiguous' | 'interrupted'

type OcrPoolFailureScope = 'page' | 'target' | 'lane'

export type OcrPoolAttemptUsage = {
  requestedReasoningEffort?: string | undefined
  effectiveReasoningEffort?: string | undefined
  promptTokens?: number | undefined
  completionTokens?: number | undefined
  providerCostCents?: number | undefined
  providerCostSource?: string | undefined
  providerUsage?: Array<Record<string, unknown>> | undefined
}

export type OcrPoolPageAttempt = OcrPoolAttemptUsage & {
  attempt: number
  claimId: string
  provider: OcrTarget['service']
  model: string
  laneKey: string
  status: OcrPoolAttemptStatus
  requestedReasoningEffort?: string | undefined
  effectiveReasoningEffort?: string | undefined
  startedAtMs: number
  finishedAtMs?: number | undefined
  durationMs?: number | undefined
  artifactDir: string
  failureScope?: OcrPoolFailureScope | undefined
  failure?: Record<string, unknown> | undefined
}

type OcrPoolAcceptedPage = OcrPoolAttemptUsage & {
  provider: OcrTarget['service']
  model: string
  requestedReasoningEffort?: string | undefined
  effectiveReasoningEffort?: string | undefined
  attempt: number
  acceptedAtMs: number
  durationMs: number
  artifactDir: string
  result: import('~/types').PageResult
}

export type OcrPoolPageLedgerEntry = {
  pageNumber: number
  status: 'pending' | 'claimed' | 'accepted' | 'exhausted'
  claim?: {
    claimId: string
    targetKey: string
    laneKey: string
    attempt: number
    claimedAtMs: number
  } | undefined
  accepted?: OcrPoolAcceptedPage | undefined
  attempts: OcrPoolPageAttempt[]
}

export type OcrPoolTargetState = {
  service: OcrTarget['service']
  model: string
  targetKey: string
  laneKey: string
  local: boolean
  status: 'eligible' | 'running' | 'succeeded' | 'retired'
  attempts: number
  acceptedPages: number
  active: number
  activePeak: number
  lastFailure?: Record<string, unknown> | undefined
}

export type OcrPoolLaneState = {
  laneKey: string
  service: OcrTarget['service']
  local: boolean
  cap: number
  status: 'eligible' | 'retired'
  active: number
  activePeak: number
  lastFailure?: Record<string, unknown> | undefined
}

type OcrPoolSchedulerTelemetry = {
  queueDepth: number
  queueDepthPeak: number
  claims: number
  acceptedPages: number
  requeues: number
  handoffs: number
  exhaustedPages: number
  duplicateCommitsPrevented: number
  ambiguousAttempts: number
  interruptedClaimsRecovered: number
  retiredTargets: string[]
  retiredLanes: string[]
  retryPressure: number
  pauseTimeMs: number
  targetActivePeaks: Record<string, number>
  laneCaps: Record<string, number>
  targetPageShare: Record<string, number>
  targetThroughputPagesPerMinute: Record<string, number | null>
  gatingTarget?: string | undefined
}

export type OcrPoolLedger = {
  mode: 'pool'
  totalPages: number
  status: 'running' | 'full' | 'incomplete'
  pages: OcrPoolPageLedgerEntry[]
  targets: OcrPoolTargetState[]
  lanes: OcrPoolLaneState[]
  telemetry: OcrPoolSchedulerTelemetry
}

export type OcrPoolProcessedPage = OcrPoolAttemptUsage & {
  result: import('~/types').PageResult
}

export type OcrPoolClassifiedFailure = OcrPoolAttemptUsage & {
  scope: OcrPoolFailureScope
  ambiguous: boolean
  failure: Record<string, unknown>
}

export type RunOcrPagePoolOptions = {
  totalPages: number
  requestedTargets: OcrTarget[]
  targetsToRun: OcrTarget[]
  providerConcurrency: number
  localConcurrency: number
  restoredLedger?: OcrPoolLedger | undefined
  reenabledTargets?: OcrTarget[] | undefined
  getLaneKey: (target: OcrTarget) => string
  getTargetConcurrency: (target: OcrTarget) => number
  getAttemptArtifactDir: (pageNumber: number, target: OcrTarget, attempt: number) => string
  processPage: (input: {
    pageNumber: number
    target: OcrTarget
    attempt: number
    claimId: string
    artifactDir: string
  }) => Promise<OcrPoolProcessedPage>
  classifyFailure: (error: unknown, target: OcrTarget) => OcrPoolClassifiedFailure
  onCheckpoint?: ((ledger: OcrPoolLedger) => Promise<void>) | undefined
  now?: (() => number) | undefined
  createClaimId?: (() => string) | undefined
}
