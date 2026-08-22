import type {
  AnyCapabilityRecord,
  CanonicalAudioProviderProjection,
  CanonicalDialogueTurn,
  ComicTtsRenderContext,
  CurrentTtsRenderArtifacts,
  GenericTtsDialoguePlan,
  GenericTtsSourceIdentity,
  NormalizedTiming,
  ObservedAudioFormat,
  ObservedProviderRequest,
  PipelineProviderState,
  PlannedCost,
  ProviderBatchInvocationPlan,
  ProviderBatchResult,
  ProviderRenderBranchCandidate,
  ProviderRenderBranchPlan,
  ProviderRenderPlan,
  ProviderRenderStrategy,
  ProviderRetryRecord,
  RenderAdmissionJournalSnapshot,
  ResolvedVoiceBinding,
  SanitizedProviderError,
  TtsOptions,
  TtsRequestEvidenceScope,
  TtsTarget,
  TypedProviderSynthesisSettings,
} from '~/types'

export type WrittenJson<T> = { value: T, path: string, sha256: string }

export type AttemptTurn = {
  sourceIndex: number
  canonical: CanonicalDialogueTurn
  voice: { kind: 'provider-id' | 'reference-asset' | 'local-model-voice', value?: string | undefined, valueHash: string }
  binding: ResolvedVoiceBinding
  controls: TypedProviderSynthesisSettings
  effectiveControls: Readonly<Record<string, unknown>>
}

export type AttemptSlot = {
  batchId: string
  generationSlotId: string
  slotIndex: number
  turnIds: string[]
  providerText: string
  plannedCost: PlannedCost
  expectedRequestControlsHash: string
  expectedEndpointKind: string
  expectedSerializerVersion: string
  expectedVoiceField: string
  slotHash?: string | undefined
  timingSegmentIndex?: number | undefined
}

export type RecordedOutput = {
  path: string
  relativeToBatchResult: string
  sha256: string
  format: ObservedAudioFormat
  durationMs: number
  timing?: NormalizedTiming<'take-audio-ms'> | undefined
  providerGenerationId?: string | undefined
  warnings?: readonly string[] | undefined
}

export type RuntimeRequest = {
  slot: AttemptSlot
  invocationFile: WrittenJson<ProviderBatchInvocationPlan>
  request: ObservedProviderRequest
  retry?: ProviderRetryRecord | undefined
  terminal: 'completed' | 'provider-rejected' | 'ambiguous' | undefined
}

export type CapabilityFixture = {
  schemaVersion: 1
  records: AnyCapabilityRecord[]
  capabilityFixtureHash: string
  capabilityScopeHash: string
}

export type CurrentTtsRecoveredGenerationSlot = Readonly<{
  value: ProviderBatchResult
  path: string
  sha256: string
  attemptRoot?: string | undefined
  outputPaths: readonly string[]
  requiresMaterialization?: boolean | undefined
}>

export type CurrentTtsRenderAttempt = {
  requestEvidence: TtsRequestEvidenceScope
  preparedState: PipelineProviderState
  providerDispatchRequired: boolean
  plannedChunkCount: number
  executionSelection?: readonly {
    generationSlotId: string
    turnId: string
    providerSegmentIndex: number
  }[] | undefined
  finalizeSuccess: (audioPath: string, reportedOutputPath: string) => Promise<CurrentTtsRenderArtifacts>
  finalizeCheckpoint: () => Promise<{
    artifactDir: string
    operation: 'tts-synthesis' | 'comic-audio'
    targetKey: string
    transport: string
    renderIdentity: string
    strategy: ProviderRenderStrategy
    projection: CanonicalAudioProviderProjection
    completedGenerationSlotIds: string[]
    remainingGenerationSlotCount: number
  }>
  finalizeFailure: (error: unknown, phase?: SanitizedProviderError['phase']) => Promise<PipelineProviderState>
}

export type CreateCurrentTtsRenderAttemptOptions = {
  outputDir: string
  artifactRoot?: string | undefined
  target: TtsTarget
  sourceText: string
  ttsOptions: TtsOptions
  sourceIdentity?: GenericTtsSourceIdentity | undefined
  dialoguePlan?: GenericTtsDialoguePlan | undefined
  comicContext?: ComicTtsRenderContext | undefined
  priorAttemptCount?: number | undefined
  recoveredSlots?: readonly CurrentTtsRecoveredGenerationSlot[] | undefined
  retainedCumulativePlannedCost?: PlannedCost | undefined
  onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
  now?: (() => string) | undefined
}

export type PureCurrentTtsRenderPlanOptions = Omit<CreateCurrentTtsRenderAttemptOptions, 'outputDir' | 'artifactRoot' | 'onProviderState' | 'priorAttemptCount' | 'recoveredSlots' | 'retainedCumulativePlannedCost' | 'now'>

export type PureCurrentTtsReadinessPlan = Readonly<{
  operation: 'tts-synthesis' | 'comic-audio'
  transport: string
  targetKey: string
  capability: CapabilityFixture
  capabilityFixtureHash: string
  capabilityScopeHash: string
  branchCandidate: ProviderRenderBranchCandidate
  branchPlan: ProviderRenderBranchPlan
  renderPlan: ProviderRenderPlan
  renderPlanId: string
  renderIdentity: string
  strategy: ProviderRenderStrategy
  plannedCost: PlannedCost
}>

export type CurrentTtsCompletedRecovery = {
  kind: 'complete-render'
  preparedState: PipelineProviderState
  chunkCount: number
  reconciliationBlockers: readonly CurrentTtsReconciliationBlocker[]
  finalize: (workspaceDir: string, reportedOutputPath: string) => Promise<CurrentTtsRenderArtifacts>
}

export type CurrentTtsPartialRecovery = {
  kind: 'partial-slots'
  recoveredSlots: readonly CurrentTtsRecoveredGenerationSlot[]
  retainedCumulativePlannedCost: PlannedCost
  reconciliationBlockers: readonly CurrentTtsReconciliationBlocker[]
}

export type CurrentTtsSafeRedispatch = {
  kind: 'safe-redispatch'
  retainedCumulativePlannedCost: PlannedCost
  reconciliationBlockers: readonly CurrentTtsReconciliationBlocker[]
}

export type CurrentTtsReconciliationBlocker = Readonly<{
  generationSlotId: string
  state: RenderAdmissionJournalSnapshot['requests'][number]['transitions'][number]['state']
  attempt: number
  invocationId: string
  requestOrdinal: number
}>

export type CurrentTtsResumePricePlan = Readonly<{
  readiness: PureCurrentTtsReadinessPlan
  plannedCost: PlannedCost
  plannedSlotCount: number
  unresolvedSlotCount: number
  unresolvedCharacterCount: number
  recoveredSlotCount: number
  recoveryKind: 'none' | CurrentTtsCompletedRecovery['kind'] | CurrentTtsPartialRecovery['kind'] | CurrentTtsSafeRedispatch['kind']
  reconciliationBlockers: readonly CurrentTtsReconciliationBlocker[]
}>
