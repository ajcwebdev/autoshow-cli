import type { OcrPoolLaneState, OcrPoolLedger, OcrPoolPageAttempt, OcrPoolPageLedgerEntry, OcrPoolTargetState, OcrTarget, RunOcrPagePoolOptions } from '~/types'

export type AcceptedRunState = {
  count: number
  lastAcceptedAtMs: number
}

export type OcrPoolClaim = {
  page: OcrPoolPageLedgerEntry
  attempt: OcrPoolPageAttempt
  target: OcrTarget
  targetState: OcrPoolTargetState
  lane: OcrPoolLaneState
}

export type OcrPoolState = {
  ledger: OcrPoolLedger
  targetByKey: Map<string, OcrTarget>
  targetStates: Map<string, OcrPoolTargetState>
  laneStates: Map<string, OcrPoolLaneState>
  runnableKeys: Set<string>
  reenabledKeys: Set<string>
  attemptedThisRun: Map<number, Set<string>>
  targetCaps: Map<string, number>
  acceptedThisRun: Map<string, AcceptedRunState>
  startedAtMs: number
  now: () => number
  createClaimId: () => string
  getAttemptArtifactDir: RunOcrPagePoolOptions['getAttemptArtifactDir']
}
