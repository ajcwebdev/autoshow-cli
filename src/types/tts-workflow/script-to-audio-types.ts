import type { PipelineProviderStatus } from '../provider-core/provider-contract-types'
import type { TtsProvider } from '../provider-core/provider-types'

export type CapabilityMaturity = 'stable' | 'preview' | 'deprecated' | 'not-applicable'
export type CapabilityChannel = 'api' | 'ui-only' | 'external-import' | 'unsupported'
export type AdapterSupport = 'implemented' | 'planned' | 'unsupported'

export type VoiceCapabilityFeature =
  | 'turn-synthesis'
  | 'native-dialogue'
  | 'native-utterances'
  | 'voice-catalog'
  | 'voice-design'
  | 'voice-remix'
  | 'instant-clone'
  | 'professional-clone'
  | 'voice-import'
  | 'voice-delete'
  | 'acting-description'
  | 'word-timing'
  | 'phoneme-timing'
  | 'continuation'
  | 'speech-to-speech'

export type ProviderAccessRequirement =
  | { kind: 'plan', tier?: string | undefined }
  | { kind: 'approval', approvalKind?: string | undefined }
  | { kind: 'verification', verificationKind?: string | undefined }
  | { kind: 'region', allowedRegionCodes: string[] }

export type AccountCapabilityState =
  | 'available'
  | 'not-configured'
  | 'unavailable'
  | 'external-action-required'
  | 'unknown'

export type CapabilityScope = {
  provider: TtsProvider
  feature: VoiceCapabilityFeature
  model?: string | undefined
  transport?: string | undefined
}

export type TurnSynthesisConstraints = {
  voiceKinds: ProviderVoiceLocator['kind'][]
  maxCharacters?: number | undefined
  supportedOutputFormats?: string[] | undefined
}

export type NativeDialogueConstraints = TurnSynthesisConstraints & {
  minSpeakers: number
  maxSpeakers: number
  maxTurns?: number | undefined
}

export type NativeUtteranceConstraints = TurnSynthesisConstraints & {
  maxUtterances?: number | undefined
  maxTakesPerRequest?: number | undefined
}

export type VoiceCatalogConstraints = {
  paginated: boolean
  stableResourceIds: boolean
}

export type VoiceManagementConstraints = {
  requiresConsent: boolean
  createsRemoteResource: boolean
}

export type TimingConstraints = {
  providerTimeUnit: string
  providerIndexUnit?: PreparedProviderText['providerIndexUnit'] | undefined
}

export type CapabilityConstraintsByFeature = {
  'turn-synthesis': TurnSynthesisConstraints
  'native-dialogue': NativeDialogueConstraints
  'native-utterances': NativeUtteranceConstraints
  'voice-catalog': VoiceCatalogConstraints
  'voice-design': VoiceManagementConstraints
  'voice-remix': VoiceManagementConstraints
  'instant-clone': VoiceManagementConstraints
  'professional-clone': VoiceManagementConstraints
  'voice-import': VoiceManagementConstraints
  'voice-delete': { projectOwnedOnly: boolean }
  'acting-description': { maxCharacters?: number | undefined }
  'word-timing': TimingConstraints
  'phoneme-timing': TimingConstraints
  'continuation': { providerVersions: string[] }
  'speech-to-speech': { speechBusesOnly: boolean }
}

export type CapabilityDocumentationEvidence = {
  checkedAt: string
  sourceRefs: string[]
  evidenceHash: string
}

export type CapabilityRecord<F extends VoiceCapabilityFeature> = {
  scope: CapabilityScope & { feature: F }
  maturity: CapabilityMaturity
  channel: CapabilityChannel
  adapterSupport: AdapterSupport
  requirements: ProviderAccessRequirement[]
  constraints: CapabilityConstraintsByFeature[F]
  reason?: string | undefined
  documentationEvidence: CapabilityDocumentationEvidence
}

export type AnyCapabilityRecord = {
  [F in VoiceCapabilityFeature]: CapabilityRecord<F>
}[VoiceCapabilityFeature]

export type AccountCapabilityObservation = {
  observationHash: string
  capabilityScopeHash: string
  capabilityFixtureHash: string
  accountScopeHash: string
  state: AccountCapabilityState
  satisfiedRequirements: ProviderAccessRequirement[]
  unmetRequirements: ProviderAccessRequirement[]
  checkedAt: string
  expiresAt?: string | undefined
  evidenceRefs: string[]
  reason?: string | undefined
}

export type ProtectedAssetRef = {
  storeId: string
  assetId: string
  sha256: string
}

export type TtsCliReferenceInput = {
  speakerKey?: string | undefined
  sourcePath: string
  authorizationRef: string
}

export type VoiceOrigin =
  | 'provider-stock'
  | 'community-library'
  | 'designed'
  | 'remixed'
  | 'instant-clone'
  | 'professional-clone'
  | 'imported-custom'
  | 'saved-reference'
  | 'request-reference-audio'
  | 'local-model-voice'

export type VoiceDeletionEligibility =
  | { state: 'unknown' | 'not-owned' | 'provider-managed' | 'notice-active' | 'external-only', reason?: string | undefined, checkedAt: string }
  | { state: 'eligible', checkedAt: string, eligibilityExpiresAt?: string | undefined }
  | { state: 'deletion-pending', requestedAt: string, effectiveAt?: string | undefined }

export type ProviderVoiceLineage = {
  sourceRef: string
  sourceIdentityHash: string
  operation: 'imported' | 'designed-from' | 'remixed-from' | 'cloned-from'
  localAttemptId: string
  providerOperationId?: string | undefined
  eligibilitySnapshotHash?: string | undefined
}

export type ProviderVoiceRef =
  | {
      kind: 'remote-resource'
      provider: TtsProvider
      resourceId: string
      namespace: 'provider' | 'account'
      accountScopeHash?: string | undefined
      origin: Exclude<VoiceOrigin, 'community-library' | 'request-reference-audio' | 'local-model-voice'>
      ownership: 'provider' | 'third-party' | 'account' | 'project'
      derivedFrom?: ProviderVoiceLineage | undefined
      expiresAt?: string | undefined
      deletion: VoiceDeletionEligibility
    }
  | {
      kind: 'shared-library-resource'
      provider: TtsProvider
      publicOwnerId: string
      sharedVoiceId: string
      origin: 'community-library'
      usageEligibilitySnapshotHash: string
    }
  | {
      kind: 'reference-asset'
      provider: TtsProvider
      protectedAsset: ProtectedAssetRef
      origin: 'request-reference-audio'
      authorizationRef: string
    }
  | {
      kind: 'local-model-voice'
      provider: TtsProvider
      model: string
      voiceLocator: string
      origin: 'local-model-voice'
    }

export type ProviderVoiceLocator =
  | { kind: 'provider-id', provider: TtsProvider, resourceId: string }
  | { kind: 'display-name', provider: TtsProvider, name: string }
  | { kind: 'reference-asset', provider: TtsProvider, protectedAsset: ProtectedAssetRef, authorizationRef: string }
  | { kind: 'local-model-voice', provider: TtsProvider, model: string, voiceLocator: string }

export type TypedProviderSynthesisSettings = {
  schemaVersion: 1
  settingsSchema: string
  values: Record<string, string | number | boolean | null | string[]>
}

export type TypedProviderDeliverySettings = {
  schemaVersion: 1
  settingsSchema: string
  values: Record<string, string | number | boolean | null>
}

export type TypedProviderRequestSettings = {
  schemaVersion: 1
  settingsSchema: string
  values: Record<string, string | number | boolean | null | string[]>
}

export type SanitizedProviderVoiceMetadata = Record<string, string | number | boolean | null | string[]>

export type ResolvedVoiceBinding =
  | {
      kind: 'approved-snapshot'
      snapshotId: string
      entryId: string
      entryHash: string
      providerVoice: ProviderVoiceRef
      providerModel: string
      providerRevision?: string | undefined
      settingsSchema: string
      synthesisSettings: TypedProviderSynthesisSettings
      capabilityFixtureHash: string
    }
  | {
      kind: 'transient-provider-voice'
      providerVoice: ProviderVoiceRef
      providerModel: string
      identityHash: string
      settingsSchema: string
      synthesisSettings: TypedProviderSynthesisSettings
      capabilityFixtureHash: string
    }

export type ProviderQualifiedCast = {
  schemaVersion: 1
  targets: Array<{
    provider: TtsProvider
    model: string
    transport: string
    bindings: Array<{
      speakerKey: string
      locator: ProviderVoiceLocator
      settingsSchema: string
      synthesisSettings: TypedProviderSynthesisSettings
    }>
  }>
}

export type DeliveryPlan = {
  kind: 'source' | 'reviewed-default'
  description: string
}

export type VoiceEffectPlan = {
  kind: string
  settingsHash: string
}

export type DialogueTimingCue = {
  kind: 'beat' | 'pause' | 'long-pause'
  afterTextOffset: number
  durationMs: number
  sourceSpan: CanonicalDialogueSourceSpan
}

export type CanonicalDialogueSourceSpan = {
  kind: 'spoken-text' | 'delivery' | 'stage-direction' | 'timing' | 'voice-effect' | 'simultaneous-speech' | 'scene-boundary'
  start: number
  end: number
  indexUnit: 'unicode-scalar-value'
  text: string
}

export type CanonicalDialogueTurn = {
  turnId: string
  sourceSegmentId: string
  beatIndex?: number | undefined
  subjectKey: string
  originalSpeakerLabel: string
  canonicalText: string
  sourceSpans?: CanonicalDialogueSourceSpan[] | undefined
  delivery?: DeliveryPlan | undefined
  effect?: VoiceEffectPlan | undefined
  timingCues?: DialogueTimingCue[] | undefined
}

export type CanonicalDialoguePlanNode =
  | { kind: 'turn', turn: CanonicalDialogueTurn }
  | { kind: 'overlap', groupId: string, turns: CanonicalDialogueTurn[] }

export type GenericTtsSourceIdentity = {
  schemaVersion: 1
  sourceKind: 'inline' | 'file' | 'batch-item'
  sourceLocator:
    | { kind: 'inline', label: 'inline' }
    | { kind: 'file', canonicalPath: string }
    | { kind: 'batch-item', canonicalBatchPath: string, itemIndex: number }
  contentSha256: string
  identityHash: string
}

export type GenericTtsDialoguePlan = {
  schemaVersion: 1
  dialoguePlanId: string
  sourceIdentity: GenericTtsSourceIdentity
  normalizationVersion: string
  createdAt: string
  nodes: CanonicalDialoguePlanNode[]
}

export type PreparedProviderTextSpan = {
  kind: 'mapped' | 'provider-only' | 'canonical-only'
  canonicalStart?: number | undefined
  canonicalEnd?: number | undefined
  providerStart?: number | undefined
  providerEnd?: number | undefined
  transform?: string | undefined
}

export type PreparedProviderText = {
  schemaVersion: 1
  canonicalText: string
  providerText: string
  preparationVersion: string
  canonicalIndexUnit: 'unicode-scalar-value'
  providerIndexUnit: 'unicode-scalar-value' | 'utf16-code-unit' | 'utf8-byte' | 'provider-character-array-index'
  spans: PreparedProviderTextSpan[]
}

export type RequestedAudioFormat = {
  codec: string
  container: string
  sampleRate?: number | undefined
  channels?: number | undefined
  bitRate?: number | undefined
}

export type ObservedAudioFormat = RequestedAudioFormat & {
  sampleRate: number
  channels: number
}

export type CurrencyAmount = {
  amount: number
  currency: string
}

export type PlannedCost = {
  amounts: CurrencyAmount[]
}

export type PlannedAndObservedCost = {
  planned: PlannedCost
  observed: CurrencyAmount[]
}

export type SanitizedProviderError = {
  phase: 'static-validation' | 'readiness' | 'admission' | 'synthesis' | 'selection' | 'assembly' | 'reconciliation'
  code: string
  message: string
  retryable: boolean
  blockedReason?: string | undefined
  status?: number | undefined
  stage?: string | undefined
  errorName?: string | undefined
  providerMessage?: string | undefined
  requestId?: string | undefined
  retryAfterMs?: number | undefined
}

export type ProviderResolvedDialogueTurn = CanonicalDialogueTurn & {
  providerText: PreparedProviderText
  voice: ResolvedVoiceBinding
  providerControls: TypedProviderSynthesisSettings
  providerDelivery?: TypedProviderDeliverySettings | undefined
}

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

export type LocalVoiceLocatorResult =
  | { status: 'valid', locator: ProviderVoiceLocator }
  | { status: 'invalid', error: SanitizedProviderError }

export type ProviderPreflightRequest = {
  branchPlan: ProviderRenderBranchPlan
  locators: ProviderVoiceLocator[]
}

export type LocalPreflightResult =
  | { status: 'valid', candidateIds: string[] }
  | { status: 'invalid', errors: SanitizedProviderError[] }

export type ProviderReadinessRequest = ProviderPreflightRequest & {
  accountScopeHash: string
  cancellation: AbortSignal
}

export type ProviderReadinessResult = {
  schemaVersion: 1
  readinessResultHash: string
  branchPlanId: string
  targetKey: string
  status: 'ready' | 'blocked'
  capabilityFixture?: { capabilityFixtureHash: string, path: string, sha256: string } | undefined
  capabilityObservations: AccountCapabilityObservation[]
  candidateReadiness: Array<{
    candidateId: string
    strategy: ProviderRenderStrategy
    requiredCapabilityScopeHashes: string[]
    accountObservationHashes: string[]
    status: 'ready' | 'blocked'
    errors: SanitizedProviderError[]
  }>
  resolvedVoices: Array<{
    locatorHash: string
    providerVoice: ProviderVoiceRef
    providerRevision?: string | undefined
    externallyMutable: boolean
  }>
  checkedAt: string
  errors: SanitizedProviderError[]
}

export type ProviderVoiceCatalogEntry = {
  provider: TtsProvider
  resourceId: string
  name: string
  source: 'provider-library' | 'shared-library' | 'account'
  origin: VoiceOrigin
  providerRevision?: string | undefined
  previewUrl?: string | undefined
  description?: string | undefined
  labels: Record<string, string>
  modelIds: string[]
  state: 'available' | 'pending' | 'verification-required' | 'expired' | 'unavailable'
  expiresAt?: string | undefined
  sanitizedMetadata: SanitizedProviderVoiceMetadata
}

export type ProviderVoiceCatalogPage = {
  schemaVersion: 1
  provider: TtsProvider
  entries: ProviderVoiceCatalogEntry[]
  nextCursor?: string | undefined
  checkedAt: string
}

export type ProviderVoiceDesignRequest = {
  description: string
  previewText: string
  candidateCount: number
  creationModel: string
  sourceVoice?: ProviderVoiceRef | undefined
  eligibilitySnapshotHash?: string | undefined
  seed?: number | undefined
}

export type ProviderVoiceDesignPreview = {
  providerCandidateId: string
  providerOperationId?: string | undefined
  audioBase64: string
  mediaType: string
  durationMs?: number | undefined
  expiresAt?: string | undefined
  sanitizedMetadata: SanitizedProviderVoiceMetadata
}

export type ProviderVoiceDesignResult = {
  schemaVersion: 1
  provider: TtsProvider
  operation: 'design' | 'remix'
  creationModel: string
  previews: ProviderVoiceDesignPreview[]
  checkedAt: string
}

export type ProviderVoiceMaterializationRequest = {
  providerCandidateId: string
  desiredName: string
  localAttemptId: string
  protectedPreview?: ProtectedAssetRef | undefined
  sourceVoice?: ProviderVoiceRef | undefined
  eligibilitySnapshotHash?: string | undefined
}

export type ProviderVoiceCloneRequest = {
  cloneKind: 'instant' | 'professional'
  desiredName: string
  localAttemptId: string
  protectedSamples: ProtectedAssetRef[]
  consentRecordRef: string
  provenanceRef: string
  description?: string | undefined
}

export type ProviderVoiceMutationResult = {
  schemaVersion: 1
  provider: TtsProvider
  state: 'ready' | 'pending' | 'verification-required' | 'external-action-required'
  providerVoice?: ProviderVoiceRef | undefined
  providerOperationId?: string | undefined
  action?: string | undefined
  sanitizedMetadata: SanitizedProviderVoiceMetadata
  checkedAt: string
}

export type ProviderVoiceInspection = {
  schemaVersion: 1
  provider: TtsProvider
  providerVoice: ProviderVoiceRef
  state: 'available' | 'pending' | 'verification-required' | 'missing' | 'expired'
  providerRevision?: string | undefined
  deletion: VoiceDeletionEligibility
  sanitizedMetadata: SanitizedProviderVoiceMetadata
  checkedAt: string
}

export type ProviderVoiceDeleteRequest = {
  providerVoice: ProviderVoiceRef
  expectedResourceId: string
  expectedName?: string | undefined
}

export type VoiceCatalogPort = {
  list: (input?: { cursor?: string | undefined, source?: 'provider-library' | 'shared-library' | 'account' | undefined }) => Promise<ProviderVoiceCatalogPage>
}
export type VoiceDesignPort = {
  createCandidate: (request: ProviderVoiceDesignRequest) => Promise<ProviderVoiceDesignResult>
  materializeCandidate: (request: ProviderVoiceMaterializationRequest) => Promise<ProviderVoiceMutationResult>
}
export type VoiceClonePort = { clone: (request: ProviderVoiceCloneRequest) => Promise<ProviderVoiceMutationResult> }
export type VoiceLifecyclePort = {
  inspect: (voice: ProviderVoiceRef) => Promise<ProviderVoiceInspection>
  delete: (request: ProviderVoiceDeleteRequest) => Promise<{ deletedAt: string }>
}
export type VoiceAuditionPort = { audition: (request: ExplicitVoiceSynthesisRequest) => Promise<ProviderBatchSynthesisResponse> }
export type NativeDialoguePort = { render: (request: ExplicitVoiceSynthesisRequest) => Promise<ProviderBatchSynthesisResponse> }
export type ContinuationPort = { validate: (continuation: ResolvedContinuationInput) => LocalPreflightResult }

export interface TtsVoiceProvider {
  readonly provider: TtsProvider
  getDeclaredCapabilities(): readonly AnyCapabilityRecord[]
  parseVoiceLocator(locator: ProviderVoiceLocator): LocalVoiceLocatorResult
  validatePlan(request: ProviderPreflightRequest): LocalPreflightResult
  checkExecutionReadiness?(request: ProviderReadinessRequest): Promise<ProviderReadinessResult>
  renderBatch(request: ExplicitVoiceSynthesisRequest): Promise<ProviderBatchSynthesisResponse>
  catalog?: VoiceCatalogPort | undefined
  design?: VoiceDesignPort | undefined
  clone?: VoiceClonePort | undefined
  lifecycle?: VoiceLifecyclePort | undefined
  audition: VoiceAuditionPort
  nativeDialogue?: NativeDialoguePort | undefined
  continuation?: ContinuationPort | undefined
}

export type RenderRelativeArtifactPath = string
export type AttemptRelativeArtifactPath = string
export type ProviderBatchResultRelativeArtifactPath = string
export type AudioRunRelativeArtifactPath = string

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
  | { source: 'cache-materialization', sourceBatchResultId: string, observedRequestOrdinals: [] }
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

export type CacheSourceProvenanceAttestation = {
  schemaVersion: 1
  attestationId: string
  sourceCanonicalCommitment: {
    targetKey: string
    renderPlanId: string
    renderIdentity: string
    eventSequence: number
    eventRecordHash: string
    batchResultId: string
    batchResultSha256: string
  }
  sourceInvocation: {
    batchInvocationPlanId: string
    batchInvocationPlanSha256: string
    batchId: string
    generationSlotId: string
    requestFingerprint: string
    continuationFingerprint: ProviderContinuationSemanticFingerprint
    continuationDag:
      | { kind: 'none' }
      | {
          kind: 'checkpoint'
          predecessorBatchId: string
          predecessorBatchResultId: string
          predecessorBatchResultSha256: string
          selectionId: string
          selectionSha256: string
          checkpointId: string
          checkpointSha256: string
          selectedTakeId: string
          selectedTakeAudioSha256: string
          selectedTakeTimingSha256?: string | undefined
          providerGenerationIdentityHash: string
          selectedTakeSemanticHash: string
          continuationStateHash: string
        }
  }
  sourceAdmission: {
    journalId: string
    terminalSnapshotId: string
    terminalSnapshotSha256: string
    requestChainProjectionHash: string
    completedRequestOrdinals: number[]
  }
  observedRequestHashes: string[]
  outputChecksums: string[]
  timingEvidenceChecksums: string[]
  capturedAt: string
}

export type SynthesisCacheEntry = {
  schemaVersion: 1
  keyAlgorithmVersion: string
  kind: 'segmented-turn' | 'native-batch'
  generationSlotKey: string
  canonicalInputHash: string
  bindingIdentityHashes: string[]
  continuationFingerprint: ProviderContinuationSemanticFingerprint
  capabilityFixtureHash: string
  adapterSchemaVersion: string
  textPreparationVersion: string
  observedRequestHashes: string[]
  provenanceAttestation: SynthesisCacheObjectRef
  sourceBatchResult: { batchResultId: string, object: SynthesisCacheObjectRef }
  objects: SynthesisCacheObjectRef[]
  outputChecksums: string[]
  createdAt: string
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

export type CurrentCacheProvenanceCopy = {
  schemaVersion: 1
  source: SynthesisCacheObjectRef
  artifactRef: ProviderBatchResultRelativeArtifactPath
  sha256: string
}

export type CacheMaterializationEvidence = {
  materializationPlan: { cacheMaterializationPlanId: string, artifactRef: RenderRelativeArtifactPath, sha256: string }
  sourceBatchResultId: string
  cacheEntry: CurrentCacheProvenanceCopy
  sourceBatchResult: CurrentCacheProvenanceCopy
  sourceProvenanceAttestation: CurrentCacheProvenanceCopy
  materializedObjects: Array<{ source: SynthesisCacheObjectRef, artifactRef: ProviderBatchResultRelativeArtifactPath, sha256: string }>
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
      cacheMaterialization?: never
    }
  | {
      provenance: 'cache-materialization'
      status: 'succeeded'
      invocationId?: never
      attempt?: never
      batchInvocationPlan?: never
      admissionBasis?: never
      observedRequests: []
      retryAttempts: []
      createdResources: []
      cacheMaterialization: CacheMaterializationEvidence
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

export type AdmissionProofKind = 'acceptance' | 'completion' | 'rejection' | 'ambiguity' | 'not-admitted'

export type SanitizedAdmissionEvidenceFields = Record<string, string | number | boolean | null>

export type SanitizedAdmissionEvidence<Kind extends AdmissionProofKind = AdmissionProofKind> = {
  schemaVersion: 1
  evidenceHash: string
  journalId: string
  invocationId: string
  provider: TtsProvider
  requestOrdinal: number
  requestFingerprint: string
  evidenceKind: Kind
  observedAt: string
  fields: SanitizedAdmissionEvidenceFields
}

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

export type ConsumedSelectionRebuildAuthorization = {
  schemaVersion: 1
  authorizationId: string
  renderPlanId: string
  renderIdentity: string
  baseResultIdentity: string
  expectedActiveEventSequence: number
  expectedSelectedBatchResultId: string
  replacementSelectedBatchResultId: string
  batchResultSetHash: string
  expectedSelectionId: string
  replacementSelectionId: string
  invalidatedBatchIds: string[]
  authorizedPotentialDispatchSlots: Array<{ batchId: string, generationSlotId: string }>
  additionalPlannedCost: PlannedCost
  retryAllowance: PlannedCost
  authorizedBy: AuditActorRef
  authorizedAt: string
}

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
        source: 'cache-materialization'
        materializationPlan: { cacheMaterializationPlanId: string, path: RenderRelativeArtifactPath, sha256: string }
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

export type CanonicalAudioProviderProjection = {
  activeWork?:
    | { kind: 'branch', branchPlanId: string, readinessAttemptSequence?: number | undefined }
    | { kind: 'render', renderIdentity: string, eventSequence: number }
    | { kind: 'policy-skip', evidence: ProviderPolicySkipEvidence }
    | undefined
  selectedSuccess?: { renderIdentity: string, eventSequence: number, resultIdentity: string, audioRunId: string } | undefined
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

export type ProviderTimingEvidenceArtifact = {
  schemaVersion: 1
  timingEvidenceId: string
  provider: TtsProvider
  model: string
  providerIndexUnit?: PreparedProviderText['providerIndexUnit'] | undefined
  providerTimeUnit: string
  payload: Record<string, string | number | boolean | null | Array<string | number>>
}

export type RenderTakesArtifact = {
  schemaVersion: 1
  renderTakesId: string
  renderPlanId: string
  renderIdentity: string
  generationSlots: Array<{ batchId: string, generationSlotId: string, batchResult: ProviderBatchResultRef }>
}

export type TakeSelection = {
  schemaVersion: 1
  selectionId: string
  renderPlanId: string
  renderIdentity: string
  batchId: string
  batchResults: [ProviderBatchResultRef, ...ProviderBatchResultRef[]]
} & (
  | { state: 'unselected' }
  | {
      state: 'selected'
      selectedBatchResultId: string
      selectedTakeId: string
      policy: 'sole-take' | 'manual' | 'first-generated' | 'explicit-id'
      selectedBy: AuditActorRef
      selectedAt: string
      supersedesSelectionId: string
    }
)

export type ContinuationCheckpoint = {
  schemaVersion: 1
  checkpointId: string
  renderPlanId: string
  renderIdentity: string
  batchResult: ProviderBatchResultRef
  selection: { selectionId: string, path: string, sha256: string }
  provider: TtsProvider
  model: string
  providerVersion: string
  batchId: string
  selectedTakeId: string
  continuationState:
    | { kind: 'provider-generation-id', value: string }
    | { kind: 'protected-token', asset: ProtectedAssetRef }
  createdAt: string
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
