import type {
  AuditActorRef,
  PlannedCost,
  ProtectedAssetRef,
  ProviderVoiceRef,
  SanitizedProviderError,
  SanitizedProviderVoiceMetadata,
  TtsProvider,
  TypedProviderSynthesisSettings,
} from '~/types'

type ProtectedVoiceAssetPurpose =
  | 'reference-audio'
  | 'candidate-preview'
  | 'audition-audio'
  | 'consent-evidence'
  | 'reconciliation-evidence'

type ProtectedVoiceAssetRetention = {
  mode: 'retain-until' | 'retain-until-revoked' | 'delete-after-operation'
  expiresAt?: string | undefined
  obligationRef?: string | undefined
}

export type ProtectedVoiceAssetPolicy = {
  schemaVersion: 1
  purpose: ProtectedVoiceAssetPurpose
  authorizationRef: string
  retention: ProtectedVoiceAssetRetention
  consentRecordRef?: string | undefined
  createdAt: string
}

export type VoiceConsentAction =
  | 'upload'
  | 'new-synthesis'
  | 'cache-reuse'
  | 'resume'
  | 'export'
  | 'retention'
  | 'deletion'

type VoiceConsentGrant = {
  action: VoiceConsentAction
  allowed: boolean
  expiresAt?: string | undefined
  obligationRef?: string | undefined
}

export type VoiceConsentRecord = {
  schemaVersion: 1
  consentRecordId: string
  subjectKey: string
  provenanceRef: string
  status: 'active' | 'revoked' | 'expired'
  grants: VoiceConsentGrant[]
  evidence?: ProtectedAssetRef | undefined
  recordedAt: string
  recordedBy: AuditActorRef
  revokedAt?: string | undefined
  revocationReason?: string | undefined
}

export type VoiceConsentRevocation = {
  schemaVersion: 1
  revocationId: string
  consentRecordId: string
  revokedAt: string
  reason: string
  revokedBy: AuditActorRef
}

export type VoiceRetentionPolicy = {
  protectedAssets: 'retain' | 'delete-on-revocation' | 'delete-after-provisioning'
  providerResource: 'retain' | 'delete-on-retirement' | 'external'
  cacheAfterRevocation: 'deny' | 'allow-existing'
  exportAfterRevocation: 'deny' | 'allow-existing'
  obligationRef?: string | undefined
}

type VoiceCleanupState =
  | { state: 'retained', checkedAt: string }
  | { state: 'deletion-required', reason: string, requiredAt: string }
  | { state: 'deletion-pending', requestedAt: string }
  | { state: 'deleted', deletedAt: string }
  | { state: 'external-action-required', action: string, checkedAt: string }

export type VoiceProvisioningState =
  | { state: 'ready', providerVoice: ProviderVoiceRef }
  | { state: 'pending', operationId: string, providerVoice?: ProviderVoiceRef | undefined }
  | { state: 'verification-required', operationId?: string | undefined, action: string, providerVoice?: ProviderVoiceRef | undefined }
  | { state: 'approval-required', operationId?: string | undefined, action: string, providerVoice?: ProviderVoiceRef | undefined }
  | { state: 'external-action-required', action: string, providerVoice?: ProviderVoiceRef | undefined }
  | { state: 'reconciliation-required', attemptId: string, providerVoice?: ProviderVoiceRef | undefined, reason: string }
  | { state: 'missing', providerVoice: ProviderVoiceRef, reason: string }
  | { state: 'expired', providerVoice: ProviderVoiceRef }
  | { state: 'deleted', providerVoice: ProviderVoiceRef, deletedAt: string }
  | { state: 'failed', code: string, message: string, providerVoice?: ProviderVoiceRef | undefined }

type VoiceProvisioningOperation = 'design' | 'remix' | 'clone' | 'import' | 'save-reference'

export type VoiceIssuedResource = {
  providerVoice: ProviderVoiceRef
  observedAt: string
  sanitizedResponseHash: string
}

export type VoiceProvisioningAttempt = {
  schemaVersion: 1
  attemptId: string
  registrationDraftId: string
  operation: VoiceProvisioningOperation
  accountScopeHash: string
  lockLeaseId: string
  requestFingerprint: string
  protectedRequestEvidence: ProtectedAssetRef
  idempotencyKey?: string | undefined
  reconciliation?: {
    strategy: 'provider-operation' | 'idempotency-lookup' | 'provider-search' | 'manual-inspection'
    providerHandle?: string | undefined
    protectedLookupEvidence: ProtectedAssetRef
  } | undefined
  transitions: Array<{
    sequence: number
    phase: 'prepared' | 'request-sent' | 'response-received' | 'ambiguous' | 'reconciled' | 'terminal'
    at: string
    evidenceHash?: string | undefined
  }>
  issuedResources: VoiceIssuedResource[]
  outcome?: VoiceProvisioningState | undefined
  compareAndSwapVersion: number
}

export type VoiceCandidate = {
  schemaVersion: 1
  candidateId: string
  registrationDraftId: string
  provider: TtsProvider
  providerModel: string
  providerCandidateId?: string | undefined
  creationModel?: string | undefined
  operation: VoiceProvisioningOperation
  sourceIdentityHash: string
  sourceVoice?: ProviderVoiceRef | undefined
  eligibilitySnapshotHash?: string | undefined
  description?: string | undefined
  previewAssets: ProtectedAssetRef[]
  plannedCost: PlannedCost
  expiresAt?: string | undefined
  expiryState: 'known' | 'not-exposed' | 'not-applicable'
  createdAt: string
  materialization:
    | { state: 'not-materialized' }
    | { state: 'materialized', attemptId: string, providerVoice: ProviderVoiceRef }
    | { state: 'blocked', error: SanitizedProviderError }
}

export type VoiceAuditionCategory = 'neutral' | 'representative' | 'emotional-delivery' | 'pronunciation' | 'comparison'

type VoiceAuditionTake = {
  takeId: string
  protectedAudio: ProtectedAssetRef
  sha256: string
  durationMs?: number | undefined
  providerGenerationId?: string | undefined
  cost: PlannedCost
  warnings: string[]
}

export type VoiceAuditionItem = {
  itemId: string
  category: VoiceAuditionCategory
  canonicalText: string
  providerText: string
  delivery?: string | undefined
  takes: VoiceAuditionTake[]
  selectedTakeId: string
}

export type VoiceAuditionManifest = {
  schemaVersion: 1
  auditionId: string
  registrationDraftId: string
  provider: TtsProvider
  providerModel: string
  providerVoice: ProviderVoiceRef
  capabilityFixtureHash: string
  settingsSchema: string
  synthesisSettings: TypedProviderSynthesisSettings
  items: VoiceAuditionItem[]
  plannedCost: PlannedCost
  warnings: string[]
  createdAt: string
}

type VoiceRegistrationBase = {
  schemaVersion: 1
  registrationId: string
  generationId: string
  priorGenerationId?: string | undefined
  subjectKey: string
  profileKey: string
  provider: TtsProvider
  providerModel: string
  creationModel?: string | undefined
  briefHash: string
  provenanceRef: string
  consentRecordRef?: string | undefined
  settingsSchema: string
  synthesisSettings: TypedProviderSynthesisSettings
  capabilityFixtureHash: string
  accountCapabilityObservationHash?: string | undefined
  sanitizedProviderMetadata: SanitizedProviderVoiceMetadata
  retention: VoiceRetentionPolicy
  cleanupState: VoiceCleanupState
  createdAt: string
  updatedAt: string
}

export type VoiceRegistration =
  | VoiceRegistrationBase & {
      approval: { state: 'approved', auditionId: string, approvedAt: string, approvedBy: AuditActorRef }
      provisioning: { state: 'ready', providerVoice: ProviderVoiceRef }
      approvedAuditionId: string
    }
  | VoiceRegistrationBase & {
      approval:
        | { state: 'draft' }
        | { state: 'auditioned', auditionId: string }
        | { state: 'retired', priorAuditionId?: string | undefined, retiredAt: string }
        | { state: 'revoked', priorAuditionId?: string | undefined, revokedAt: string, reason: string }
      provisioning: VoiceProvisioningState
      approvedAuditionId?: string | undefined
    }

export type VoiceRegistrationCatalog = {
  schemaVersion: 1
  registrations: VoiceRegistration[]
}

type CurrentVoiceRegistrationSelection = {
  subjectKey: string
  provider: TtsProvider
  providerModel: string
  profileKey: string
  registrationId: string
  generationId: string
  updatedAt: string
}

export type CurrentVoiceRegistrationIndex = {
  schemaVersion: 2
  revision: number
  selections: CurrentVoiceRegistrationSelection[]
}
