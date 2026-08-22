import type { TtsProvider } from '../provider-core/provider-types'
import type { ProviderBatchResultRelativeArtifactPath, RenderRelativeArtifactPath } from './artifact-path-types'
import type { PlannedCost, PreparedProviderText, ProtectedAssetRef, ProviderResolvedDialogueTurn, RequestedAudioFormat, ResolvedVoiceBinding, TypedProviderDeliverySettings, TypedProviderRequestSettings, TypedProviderSynthesisSettings } from './voice-and-dialogue-types'

export type ProviderRenderStrategy = 'native-dialogue' | 'native-utterances' | 'segmented' | 'hybrid'
export type ProviderRenderModePreference = 'auto' | 'native' | 'segmented' | 'repair'

export type ProviderGenerationSlotPlan = {
  generationSlotId: string
  slotIndex: number
  requestedTakeCount: number
  plannedCost: PlannedCost
}
export type IncomingContinuationBinding = {
  checkpointId: string
  checkpointRef: string
  checkpointSha256: string
  sourceRenderIdentity: string
  sourceResultIdentity: string
  sourceAudioRunId: string
  predecessorBatchId: string
  selectedTakeId: string
  provider: TtsProvider
  model: string
  providerVersion: string
  continuationStateHash: string
}

export type ProviderBatchContinuationPlan =
  | { kind: 'none' }
  | { kind: 'external-checkpoint', binding: IncomingContinuationBinding }
  | { kind: 'prior-batch-selection', predecessorBatchId: string }

export type ProviderBatchPlan = {
  batchId: string
  orderedTurnIds: string[]
  requestControls: TypedProviderRequestSettings
  generationSlots: ProviderGenerationSlotPlan[]
  takeSelectionPolicy: 'sole-take' | 'manual' | 'first-generated'
  continuation: ProviderBatchContinuationPlan
  plannedCost: PlannedCost
}

export type HybridRepairDependencies = {
  schemaVersion: 1
  baseTargetKey: string
  baseSourceIdentityHash: string
  baseDialoguePlanId: string
  baseRenderIdentity: string
  baseRenderPlanId: string
  baseResultIdentity: string
  baseResultRef: string
  baseResultSha256: string
  reusedOutputs: Array<{
    baseBatchResultId: string
    outputId: string
    artifactRef: ProviderBatchResultRelativeArtifactPath
    sha256: string
    sourceTurnIds: string[]
    coveredCanonicalRanges: Array<{
      turnId: string
      start: number
      end: number
      indexUnit: 'unicode-scalar-value'
      canonicalTextSliceHash: string
      preparedProviderTextSliceHash: string
      bindingIdentityHash: string
      providerVoiceRevisionHash?: string | undefined
      providerControlsHash: string
      providerDeliveryHash?: string | undefined
      requestedOutputHash: string
    }>
  }>
  resubmittedTurnIds: string[]
}

export type ProviderRenderBranchCandidateBase = {
  candidateId: string
  requiredCapabilityScopeHashes: string[]
  batchSketches: Array<{
    orderedTurnIds: string[]
    requestControlsHash: string
    generationSlots: Array<{ slotIndex: number, requestedTakeCount: number, plannedCost: PlannedCost }>
    takeSelectionPolicy: 'sole-take' | 'manual' | 'first-generated'
    continuationPlanHash: string
  }>
  requestedOutputHash: string
  plannedCost: PlannedCost
}

export type ProviderRenderBranchCandidate =
  | ProviderRenderBranchCandidateBase & { strategy: Exclude<ProviderRenderStrategy, 'hybrid'>, repair?: never }
  | ProviderRenderBranchCandidateBase & { strategy: 'hybrid', repair: HybridRepairDependencies }

export type ProviderRenderBranchPlan = {
  schemaVersion: 1
  branchPlanId: string
  operation: 'tts-synthesis' | 'comic-audio'
  dialoguePlanId: string
  sourceIdentityHash: string
  targetKey: string
  voiceContextKey: string
  voiceContext:
    | { kind: 'approved-snapshot', snapshotId: string }
    | { kind: 'transient', bindingIdentityHashes: string[] }
  provider: TtsProvider
  model: string
  transport: string
  modePreference: ProviderRenderModePreference
  candidateStrategies: ProviderRenderBranchCandidate[]
  synthesisSettingsHash: string
  outputProfileHash: string
  capabilityFixtureHash: string
}

export type ProviderRenderVoiceContext =
  | { kind: 'approved-snapshot', snapshotId: string }
  | { kind: 'transient', bindingIdentityHashes: string[] }

export type ProviderRenderPlanBase = {
  schemaVersion: 1
  branchPlanId: string
  branchCandidateId: string
  renderPlanId: string
  renderIdentity: string
  operation: 'tts-synthesis' | 'comic-audio'
  dialoguePlanId: string
  sourceIdentityHash: string
  targetKey: string
  voiceContextKey: string
  provider: TtsProvider
  model: string
  transport: string
  synthesisSettingsHash: string
  outputProfileHash: string
  capabilityFixtureHash: string
  requiredCapabilityScopeHashes: string[]
  accountScopeHash?: string | undefined
  resolvedVoiceRevisionHashes: string[]
  requestedOutput: RequestedAudioFormat
  batches: ProviderBatchPlan[]
  plannedCost: PlannedCost
  strategyArtifacts?: {
    sourceIdentity: { identityHash: string, path: RenderRelativeArtifactPath, sha256: string }
    dialoguePlan: { dialoguePlanId: string, path: RenderRelativeArtifactPath, sha256: string }
    normalizedDialogue: { path: RenderRelativeArtifactPath, sha256: string }
    turns: Array<{ turnId: string, path: RenderRelativeArtifactPath, sha256: string }>
    generationSlots: Array<{ generationSlotId: string, path: RenderRelativeArtifactPath, sha256: string }>
  } | undefined
  nodes: Array<
    | { kind: 'turn', turn: ProviderResolvedDialogueTurn }
    | { kind: 'overlap', groupId: string, turns: ProviderResolvedDialogueTurn[] }
  >
}

export type ProviderRenderPlan =
  | ProviderRenderPlanBase & { strategy: Exclude<ProviderRenderStrategy, 'hybrid'>, voiceContext: ProviderRenderVoiceContext, repair?: never }
  | ProviderRenderPlanBase & { strategy: 'hybrid', voiceContext: ProviderRenderVoiceContext, repair: HybridRepairDependencies }

export type ResolvedContinuationInput =
  | { kind: 'none' }
  | {
      kind: 'checkpoint'
      source: 'external' | 'prior-batch'
      checkpointId: string
      checkpointRef: string
      checkpointSha256: string
      predecessorBatchId: string
      batchResultId: string
      selectionId: string
      selectedTakeId: string
      provider: TtsProvider
      model: string
      providerVersion: string
      continuationState:
        | { kind: 'provider-generation-id', value: string }
        | { kind: 'protected-token', asset: ProtectedAssetRef }
    }

export type ProviderBatchInvocationPlan = {
  schemaVersion: 1
  batchInvocationPlanId: string
  renderPlanId: string
  renderIdentity: string
  invocationId: string
  attempt: number
  batchId: string
  generationSlotId: string
  resolvedContinuation: ResolvedContinuationInput
  requestFingerprint: string
  createdAt: string
}

export type ExplicitVoiceSynthesisRequest = {
  schemaVersion: 1
  invocationId: string
  renderPlanId: string
  batchId: string
  generationSlotId: string
  requestedTakeCount: number
  batchInvocationPlan: ProviderBatchInvocationPlan
  provider: TtsProvider
  model: string
  transport: string
  turns: Array<{
    turnId: string
    text: PreparedProviderText
    voice: ResolvedVoiceBinding
    controls: TypedProviderSynthesisSettings
    delivery?: TypedProviderDeliverySettings | undefined
  }>
  requestControls: TypedProviderRequestSettings
  continuation: ResolvedContinuationInput
  output: RequestedAudioFormat
  cancellation: AbortSignal
}
