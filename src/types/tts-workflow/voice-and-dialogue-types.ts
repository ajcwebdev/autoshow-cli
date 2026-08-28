import type { TtsProvider } from '../provider-core/provider-types'

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
