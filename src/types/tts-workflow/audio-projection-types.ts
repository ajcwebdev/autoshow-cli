import type { PipelineProviderStatus } from '../provider-core/provider-contract-types'
import type { AttemptRelativeArtifactPath, AudioRunRelativeArtifactPath, ProviderBatchResultRelativeArtifactPath, RenderRelativeArtifactPath } from './artifact-path-types'
import type { ProviderRenderStrategy } from './render-plan-types'
import type { NormalizedTiming, ProviderRenderCostSummary } from './render-result-types'
import type { ObservedAudioFormat, ProtectedAssetRef, SanitizedProviderError } from './voice-and-dialogue-types'

export type AdmissionProofKind = 'acceptance' | 'completion' | 'rejection' | 'ambiguity' | 'not-admitted'

export type AdmissionProofRef<Kind extends AdmissionProofKind> = {
  journalId: string
  invocationId: string
  requestOrdinal: number
  requestFingerprint: string
  proofKind: Kind
} & (
  | { kind: 'sanitized-artifact', path: string, sha256: string }
  | { kind: 'protected-asset', asset: ProtectedAssetRef }
)

export type ProviderRequestAdmissionTransition =
  | { sequence: number, state: 'prepared', at: string, requestBodyHash: string }
  | { sequence: number, state: 'dispatch-started', at: string, transportEvidenceHash: string }
  | { sequence: number, state: 'provider-accepted', at: string, providerRequestId?: string | undefined, evidence: AdmissionProofRef<'acceptance'> }
  | { sequence: number, state: 'completed', at: string, evidence: AdmissionProofRef<'completion'> }
  | { sequence: number, state: 'provider-rejected', at: string, evidence: AdmissionProofRef<'rejection'> }
  | { sequence: number, state: 'ambiguous', at: string, evidence?: AdmissionProofRef<'ambiguity'> | undefined }
  | { sequence: number, state: 'confirmed-not-admitted', at: string, method: 'local-before-dispatch' | 'provider-idempotency-query' | 'provider-request-lookup', evidence: AdmissionProofRef<'not-admitted'> }

export type ConsumedSelectionRebuildJournalBinding = {
  authorizationId: string
  artifactRef: RenderRelativeArtifactPath
  sha256: string
  reservationEventSequence: number
  mode: 'initial' | 'recovery'
}

export type RenderAdmissionJournalSnapshot = {
  schemaVersion: 1
  journalId: string
  snapshotId: string
  previousSnapshotId?: string | undefined
  renderPlanId: string
  renderIdentity: string
  invocationId: string
  attempt: number
  plannedRequestCount: number
  plannedBatchIds: string[]
  plannedGenerationSlots: Array<{ batchId: string, generationSlotId: string }>
  consumedSelectionRebuild?: ConsumedSelectionRebuildJournalBinding | undefined
  requests: Array<{
    requestOrdinal: number
    batchId: string
    generationSlotId: string
    batchInvocationPlanId: string
    batchInvocationPlanRef: AttemptRelativeArtifactPath
    batchInvocationPlanSha256: string
    requestFingerprint: string
    retryOfRequestOrdinal?: number | undefined
    transitions: ProviderRequestAdmissionTransition[]
  }>
  recordedBatchResults: Array<{
    batchId: string
    generationSlotId: string
    batchResultId: string
    batchResultRef: AttemptRelativeArtifactPath
    batchResultSha256: string
    admissionBasisSnapshotId: string
  }>
  recordedResult?: { resultIdentity: string, resultRef: AttemptRelativeArtifactPath, resultSha256: string, batchResultSetHash: string } | undefined
  capturedAt: string
}

export type AuditActorRef = {
  namespace: 'local-user' | 'project-role' | 'automation'
  actorId: string
}

export type ProviderPolicySkipEvidence = {
  schemaVersion: 1
  skipId: string
  targetKey: string
  reasonCode: 'user-requested' | 'project-policy' | 'rights-policy'
  reason: string
  actor: AuditActorRef
  at: string
}

export type CanonicalBatchProgress = {
  batchId: string
  generationSlots: Array<
    | {
        generationSlotId: string
        source: 'provider-dispatch'
        batchInvocationPlan: { batchInvocationPlanId: string, path: RenderRelativeArtifactPath, sha256: string }
        batchResult?: { batchResultId: string, path: RenderRelativeArtifactPath, sha256: string, status: 'succeeded' | 'partial' | 'failed' | 'ambiguous' } | undefined
      }
    | {
        generationSlotId: string
        source: 'slot-reuse'
        slotHash: string
        batchResult: { batchResultId: string, path: RenderRelativeArtifactPath, sha256: string, status: 'succeeded' }
      }
  >
  currentTakeSelection?: { selectionId: string, path: string, sha256: string } | undefined
  continuationCheckpoint?: { checkpointId: string, path: string, sha256: string } | undefined
}

export type CanonicalRenderEvent = {
  sequence: number
  status: PipelineProviderStatus
  at: string
  attempt: number
  readinessAuthorization?: {
    readinessAttemptSequence: number
    branchPlanId: string
    branchCandidateId: string
    readinessResultRef: string
    readinessResultHash: string
    accountObservationHashes: string[]
  } | undefined
  admissionJournalSnapshotId?: string | undefined
  admissionJournalRef?: string | undefined
  admissionJournalSha256?: string | undefined
  providerRenderResultIdentity?: string | undefined
  providerRenderResultRef?: string | undefined
  providerRenderResultSha256?: string | undefined
  batchProgress?: CanonicalBatchProgress[] | undefined
  outputRefs?: Array<{ path: string, sha256: string }> | undefined
  reportedOutputRefs?: Array<{ path: string, sha256: string }> | undefined
  takeSelections?: Array<{ selectionId: string, path: string, sha256: string }> | undefined
  continuationCheckpoints?: Array<{ checkpointId: string, path: string, sha256: string }> | undefined
  cacheEvidenceRefs?: Array<{ path: string, sha256: string }> | undefined
  consumedSelectionRebuild?: { authorizationId: string, path: string, sha256: string, reservationEventSequence: number, mode: 'initial' | 'recovery' } | undefined
  audioRunId?: string | undefined
  audioRunRef?: string | undefined
  audioRunSha256?: string | undefined
  error?: SanitizedProviderError | undefined
}

export type CanonicalRenderRecord = {
  renderIdentity: string
  renderPlanId: string
  renderPlanRef: string
  renderPlanSha256: string
  voiceContextKey: string
  synthesisSettingsHash: string
  outputProfileHash: string
  renderDir: string
  events: CanonicalRenderEvent[]
}

export type CanonicalReadinessAttempt = {
  sequence: number
  branchPlanId: string
  readinessResultRef: string
  readinessResultHash: string
  accountObservationHashes: string[]
  at: string
} & (
  | { status: 'ready', admissionDisposition: 'eligible', error?: never }
  | { status: 'ready', admissionDisposition: 'peer-blocked', error: SanitizedProviderError }
  | { status: 'blocked', admissionDisposition: 'self-blocked', error: SanitizedProviderError }
)

export type CompactAudioArchiveSlot = {
  slotHash: string
  turnIds: string[]
  sha256: string
  durationMs: number
  voiceHash: string
}

export type CompactTargetRender = {
  schemaVersion: 1
  renderId: string
  targetKey: string
  renderIdentity: string
  renderPlanId: string
  dialoguePlanId: string
  snapshotId?: string | undefined
  strategy: ProviderRenderStrategy
  format: ObservedAudioFormat
  cost: ProviderRenderCostSummary
  slots: CompactAudioArchiveSlot[]
  outputs: {
    final: { path: string, sha256: string, durationMs: number }
  }
  retryErrorSummary?: {
    requestCount: number
    retryCount: number
    failedSlotCount: number
  } | undefined
}

export type CompactAudioArchive = {
  schemaVersion: 1
  renderRef: { path: string, sha256: string }
  timelineRef: { path: string, sha256: string }
  finalRef: { path: string, sha256: string }
  slotCount: number
}

export type CanonicalAudioProviderProjection = {
  activeWork?:
    | { kind: 'branch', branchPlanId: string, readinessAttemptSequence?: number | undefined }
    | { kind: 'render', renderIdentity: string, eventSequence: number, journalPath?: string | undefined, completedSlotHashes?: string[] | undefined }
    | { kind: 'policy-skip', evidence: ProviderPolicySkipEvidence }
    | undefined
  selectedSuccess?: { renderIdentity: string, eventSequence: number, resultIdentity: string, audioRunId: string } | undefined
  archive?: CompactAudioArchive | undefined
  branchHistory: Array<{ sequence: number, branchPlanId: string, branchPlanRef: string, branchPlanSha256: string, createdAt: string }>
  readinessAttempts: CanonicalReadinessAttempt[]
  renderHistory: CanonicalRenderRecord[]
  pointerEvents: Array<
    | { sequence: number, action: 'activate-branch', branchPlanId: string, actor: AuditActorRef, at: string }
    | { sequence: number, action: 'project-branch-readiness', branchPlanId: string, readinessAttemptSequence: number, actor: AuditActorRef, at: string }
    | { sequence: number, action: 'activate-render', renderIdentity: string, eventSequence: number, actor: AuditActorRef, at: string }
    | { sequence: number, action: 'rollback-active' | 'select-success', renderIdentity: string, eventSequence: number, resultIdentity: string, audioRunId: string, actor: AuditActorRef, at: string }
    | { sequence: number, action: 'activate-policy-skip', skipId: string, actor: AuditActorRef, at: string }
  >
}

export type RenderAudioSourceBinding =
  | { kind: 'take', sourceId: string, resultIdentity: string, batchResultId: string, selectionId: string, takeId: string, artifactRef: ProviderBatchResultRelativeArtifactPath, sha256: string }
  | { kind: 'provider-output', sourceId: string, resultIdentity: string, batchResultId: string, outputId: string, artifactRef: ProviderBatchResultRelativeArtifactPath, sha256: string }
  | { kind: 'reused-output', sourceId: string, baseResultIdentity: string, baseBatchResultId: string, outputId: string, artifactRef: ProviderBatchResultRelativeArtifactPath, sha256: string }

export type AudioMixPlan = {
  schemaVersion: 1
  mixPlanId: string
  renderIdentity: string
  outputProfileHash: string
  sources: RenderAudioSourceBinding[]
  operations: Array<{ kind: string, parametersHash: string }>
  createdAt: string
}

export type AudioTransformLedger = {
  schemaVersion: 1
  transformLedgerId: string
  renderIdentity: string
  operations: Array<{
    operationId: string
    kind: 'transcode' | 'pause' | 'crossfade' | 'overlap' | 'room-tone' | 'effect' | 'time-change'
    sourceRangeMs?: { start: number, end: number } | undefined
    finalRangeMs: { start: number, end: number }
    parametersHash: string
  }>
}

export type FinalTimeline = {
  schemaVersion: 1
  timelineId: string
  renderIdentity: string
  timing: NormalizedTiming<'final-audio-ms'>
  speechSources: RenderAudioSourceBinding[]
  transformLedgerRef: { path: AudioRunRelativeArtifactPath, sha256: string }
}

export type AudioRun = {
  schemaVersion: 1
  audioRunId: string
  targetKey: string
  renderPlanId: string
  renderIdentity: string
  providerResult: { resultIdentity: string, path: string, sha256: string }
  renderTakes?: { renderTakesId: string, path: string, sha256: string } | undefined
  takeSelections: Array<{ selectionId: string, path: string, sha256: string }>
  continuationCheckpoints: Array<{ checkpointId: string, path: string, sha256: string }>
  mixPlan: { mixPlanId: string, path: AudioRunRelativeArtifactPath, sha256: string }
  transformLedger: { transformLedgerId: string, path: AudioRunRelativeArtifactPath, sha256: string }
  finalTimeline: { timelineId: string, path: AudioRunRelativeArtifactPath, sha256: string }
  finalOutputs: Array<{ path: AudioRunRelativeArtifactPath, sha256: string, format: ObservedAudioFormat, durationMs: number }>
  createdAt: string
}
