import type { TtsProvider } from '../provider-core/provider-types'
import type { AttemptRelativeArtifactPath, ProviderBatchResultRelativeArtifactPath, RenderRelativeArtifactPath } from './artifact-path-types'
import type { ResolvedContinuationInput } from './render-plan-types'
import type { CurrencyAmount, ObservedAudioFormat, PlannedAndObservedCost, ProtectedAssetRef, ProviderVoiceRef, SanitizedProviderError } from './voice-and-dialogue-types'

export type SanitizedSerializedVoiceIdentity = {
  kind: 'provider-id' | 'reference-asset' | 'local-model-voice'
  valueHash: string
  provider: TtsProvider
}

export type ObservedProviderRequest = {
  requestOrdinal: number
  invocationId: string
  batchId: string
  generationSlotId: string
  batchInvocationPlanId: string
  provider: TtsProvider
  model: string
  transport: string
  endpointKind: string
  serializerVersion: string
  requestBodyHash: string
  actualRequestControlsHash: string
  actualContinuationHash: string
  turns: Array<{
    turnId: string
    providerTextHash: string
    voiceField: string
    actualSerializedVoice: SanitizedSerializedVoiceIdentity
    actualSerializedControlsHash: string
    actualSerializedDeliveryHash?: string | undefined
  }>
  providerRequestId?: string | undefined
  acceptedAt?: string | undefined
}

export type EphemeralProviderAudioOutput = {
  outputId: string
  path: string
  format: ObservedAudioFormat
  durationMs?: number | undefined
}

export type EphemeralProviderTake = {
  takeId: string
  output: EphemeralProviderAudioOutput
  timing?: NormalizedTiming<'take-audio-ms'> | undefined
  providerGenerationId?: string | undefined
}

export type ProviderBatchTurnOutcome = {
  turnId: string
  status: 'succeeded' | 'failed' | 'ambiguous' | 'unstarted'
  outputIds: string[]
  error?: SanitizedProviderError | undefined
}

export type ProviderBatchSynthesisResponse = {
  batchId: string
  generationSlotId: string
  batchInvocationPlanId: string
  status: 'succeeded' | 'partial' | 'failed' | 'ambiguous'
  observedRequests: ObservedProviderRequest[]
  outputs: EphemeralProviderAudioOutput[]
  takeCandidates: EphemeralProviderTake[]
  turnOutcomes: ProviderBatchTurnOutcome[]
  cost: PlannedAndObservedCost
  error?: SanitizedProviderError | undefined
}


export type ProviderBatchResultRef = {
  batchId: string
  generationSlotId: string
  batchResultId: string
  artifactRef: RenderRelativeArtifactPath
  sha256: string
}

export type ProviderBatchOutput = {
  outputId: string
  artifactRef: ProviderBatchResultRelativeArtifactPath
  sha256: string
  format: ObservedAudioFormat
  durationMs?: number | undefined
}

export type ProviderBatchOutputRef = ProviderBatchOutput & { batchResultId: string }

export type ProviderRetryRecord = {
  invocationId: string
  requestOrdinal: number
  retryOfRequestOrdinal: number
  reasonCode: string
  cost?: CurrencyAmount[] | undefined
}

export type SanitizedProviderCostEvidence = {
  evidenceHash: string
  scope: 'request' | 'generation-slot' | 'batch'
  amount: number
  currency: string
  providerRequestId?: string | undefined
}

export type TimedToken = {
  turnId: string
  subjectKey: string
  text: string
  startMs: number
  endMs: number
  canonicalStart?: number | undefined
  canonicalEnd?: number | undefined
  providerStart?: number | undefined
  visemeSymbol?: string | undefined
  providerEnd?: number | undefined
}

export type TimingClock = 'take-audio-ms' | 'final-audio-ms'

export type NormalizedTiming<Clock extends TimingClock> =
  | {
      availability: 'timed'
      clock: Clock
      provenance: 'provider-native' | 'provider-alignment' | 'assembled-segments' | 'offline-alignment'
      turns: Array<{ turnId: string, subjectKey: string, startMs: number, endMs: number }>
      words?: TimedToken[] | undefined
      phonemes?: TimedToken[] | undefined
      characters?: TimedToken[] | undefined
    }
  | {
      availability: 'unavailable'
      clock: Clock
      provenance: 'unavailable'
      turns: Array<{ turnId: string, subjectKey: string }>
      reason: string
    }

export type RenderTake = {
  takeId: string
  generationSlotId: string
  providerRequestId?: string | undefined
  providerGenerationId?: string | undefined
  audio: { artifactRef: ProviderBatchResultRelativeArtifactPath, outputId?: string | undefined, sha256: string, format: ObservedAudioFormat }
  durationMs: number
  timing: NormalizedTiming<'take-audio-ms'>
  rawProviderTimingEvidenceRef?: { timingEvidenceId: string, path: ProviderBatchResultRelativeArtifactPath, sha256: string } | undefined
  derivedCostAllocation?: { amount: number, currency: string, method: string, sourceBatchId: string } | undefined
  continuationCandidate?:
    | { kind: 'provider-generation-id', value: string }
    | { kind: 'protected-token', asset: ProtectedAssetRef }
    | undefined
  warnings: string[]
}

export type GeneratedProviderBatch = {
  batchId: string
  generationSlotId: string
  takes: RenderTake[]
  batchCost: PlannedAndObservedCost
  costEvidence: SanitizedProviderCostEvidence[]
  generatedAt: string
} & (
  | { source: 'provider-dispatch', batchInvocationPlanId: string, observedRequestOrdinals: number[] }
  | { source: 'slot-reuse', slotHash: string, observedRequestOrdinals: [] }
)

export type SynthesisCacheObjectRef = {
  cacheNamespace: string
  cacheKey: string
  objectId: string
  role: 'cache-entry' | 'provenance-attestation' | 'source-batch-result' | 'audio' | 'timing-evidence'
  sha256: string
}

export type ProviderContinuationSemanticFingerprint =
  | { schemaVersion: 1, kind: 'none', fingerprintHash: string }
  | {
      schemaVersion: 1
      kind: 'checkpoint'
      fingerprintHash: string
      provider: TtsProvider
      model: string
      providerVersion: string
      accountScopeHash?: string | undefined
      continuationStateHash: string
      selectedTakeSemanticHash: string
    }

export type CacheMaterializationPlan = {
  schemaVersion: 1
  cacheMaterializationPlanId: string
  renderPlanId: string
  renderIdentity: string
  batchId: string
  generationSlotId: string
  resolvedContinuation: ResolvedContinuationInput
  continuationFingerprint: ProviderContinuationSemanticFingerprint
  portableSemanticInputHash: string
  currentExecutionInputHash: string
  cacheEntry: SynthesisCacheObjectRef
}

export type ProviderBatchResultBase = {
  schemaVersion: 1
  batchResultId: string
  renderPlanId: string
  renderIdentity: string
  batchId: string
  generationSlotId: string
  status: 'succeeded' | 'partial' | 'failed' | 'ambiguous'
  requestedTurnIds: string[]
  outputs: ProviderBatchOutput[]
  generatedBatch?: GeneratedProviderBatch | undefined
  turnOutcomes: ProviderBatchTurnOutcome[]
  createdResources: ProviderVoiceRef[]
  cost: PlannedAndObservedCost
  error?: SanitizedProviderError | undefined
}

export type ProviderBatchResult = ProviderBatchResultBase & (
  | {
      provenance: 'provider-dispatch'
      invocationId: string
      attempt: number
      batchInvocationPlan: { batchInvocationPlanId: string, artifactRef: AttemptRelativeArtifactPath, sha256: string }
      admissionBasis: { journalId: string, snapshotId: string, artifactRef: AttemptRelativeArtifactPath, sha256: string }
      observedRequests: ObservedProviderRequest[]
      retryAttempts: ProviderRetryRecord[]
      slotHash?: never
    }
  | {
      provenance: 'slot-reuse'
      status: 'succeeded'
      slotHash: string
      invocationId?: never
      attempt?: never
      batchInvocationPlan?: never
      admissionBasis?: never
      observedRequests: []
      retryAttempts: []
      createdResources: []
      error?: never
    }
)

export type ProviderRenderCostSummary = {
  currentComposition: PlannedAndObservedCost
  closingAttempt: PlannedAndObservedCost
  cumulativeRenderHistory: PlannedAndObservedCost
}

export type ProviderRenderResult = {
  schemaVersion: 1
  resultIdentity: string
  closedBy:
    | { kind: 'provider-attempt', invocationId: string, attempt: number }
    | { kind: 'local-composition', compositionId: string }
  renderPlanId: string
  renderIdentity: string
  status: 'succeeded' | 'partial' | 'failed' | 'ambiguous'
  requestedTurnIds: string[]
  batchResults: ProviderBatchResultRef[]
  observedRequests: ObservedProviderRequest[]
  outputs: ProviderBatchOutputRef[]
  generatedBatches: GeneratedProviderBatch[]
  renderTakesArtifact?: { renderTakesId: string, artifactRef: RenderRelativeArtifactPath, sha256: string } | undefined
  turnOutcomes: Array<{
    turnId: string
    status: 'succeeded' | 'failed' | 'ambiguous' | 'unstarted'
    observedRequests: Array<{ invocationId: string, requestOrdinal: number }>
    batchIds: string[]
    generationSlotIds: string[]
    outputIds: string[]
    error?: SanitizedProviderError | undefined
  }>
  createdResources: ProviderVoiceRef[]
  retryAttempts: ProviderRetryRecord[]
  cost: ProviderRenderCostSummary
  error?: SanitizedProviderError | undefined
}
