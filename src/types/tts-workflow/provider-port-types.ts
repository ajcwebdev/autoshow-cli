import type { TtsProvider } from '../provider-core/provider-types'
import type { AccountCapabilityObservation, AnyCapabilityRecord } from './capability-types'
import type { ExplicitVoiceSynthesisRequest, ProviderRenderBranchPlan, ProviderRenderStrategy, ResolvedContinuationInput } from './render-plan-types'
import type { ProviderBatchSynthesisResponse } from './render-result-types'
import type { ProtectedAssetRef, VoiceDeletionEligibility, ProviderVoiceLocator, VoiceOrigin, ProviderVoiceRef, SanitizedProviderError, SanitizedProviderVoiceMetadata } from './voice-and-dialogue-types'

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
