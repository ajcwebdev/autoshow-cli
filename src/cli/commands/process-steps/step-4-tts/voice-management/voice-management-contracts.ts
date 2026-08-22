import type {
  AuditActorRef,
  CurrentVoiceRegistrationIndex,
  ProtectedAssetRef,
  VoiceAuditionManifest,
  VoiceCandidate,
  VoiceConsentAction,
  VoiceConsentRecord,
  VoiceProvisioningAttempt,
  VoiceProvisioningState,
  VoiceRegistration,
  VoiceRegistrationCatalog,
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import { assertContentIdentity, hashCanonicalRecordWithout } from '../script-to-audio/contract-identity'
import { validateProviderVoiceRef } from '../script-to-audio/contract-validation'
import { assertValidProtectedAssetRef } from '../voice-assets/protected-voice-asset-store'

const SAFE_KEY = /^[a-z0-9][a-z0-9_-]{0,127}$/
const LOGICAL_SUBJECT_KEY = /^(?:[a-z0-9][a-z0-9_-]{0,127}|(?:role|voice):[a-z0-9][a-z0-9_-]{0,127})$/
const SHA256 = /^[a-f0-9]{64}$/
const AUDITION_REQUIRED_CATEGORIES = ['neutral', 'representative', 'pronunciation', 'comparison'] as const
const AUDIT_ACTOR_NAMESPACES = new Set(['local-user', 'project-role', 'automation'])
const CONSENT_ACTIONS = new Set(['upload', 'new-synthesis', 'cache-reuse', 'resume', 'export', 'retention', 'deletion'])
const PROVISIONING_OPERATIONS = new Set(['design', 'remix', 'clone', 'import', 'save-reference'])
const TTS_PROVIDERS = new Set(['elevenlabs', 'minimax', 'groq', 'grok', 'mistral', 'openai', 'gemini', 'deepgram', 'speechify', 'hume', 'cartesia', 'fish', 'inworld', 'deepinfra', 'replicate', 'fal'])

const assertAllowedKeys: (value: unknown, allowed: readonly string[], label: string) => asserts value is Record<string, unknown> = (value, allowed, label) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw UsageError(`${label} must be an object.`)
  const allowedSet = new Set(allowed)
  const unknown = Object.keys(value).filter(key => !allowedSet.has(key))
  if (unknown.length > 0) throw UsageError(`${label} contains unsupported field(s): ${unknown.join(', ')}.`)
}

const assertSafeKey = (value: string, label: string): void => {
  if (!SAFE_KEY.test(value)) throw UsageError(`${label} must be a safe lowercase opaque key.`)
}

const assertSubjectKey = (value: string, label: string): void => {
  if (!LOGICAL_SUBJECT_KEY.test(value)) throw UsageError(`${label} must be a safe character key or explicit role:/voice: logical key.`)
}

const assertSha256 = (value: string, label: string): void => {
  if (!SHA256.test(value)) throw UsageError(`${label} must be a lowercase SHA-256 digest.`)
}

const assertIsoDate = (value: string, label: string): void => {
  if (Number.isNaN(Date.parse(value))) throw UsageError(`${label} must be an ISO date-time.`)
}

const assertUnique = (values: readonly string[], label: string): void => {
  if (new Set(values).size !== values.length) throw UsageError(`${label} contains duplicate values.`)
}

const assertNonSecretReference = (value: string, label: string): void => {
  if (!value.trim() || /@|[\\/]|(?:^|\s)(?:name|email|contact)\s*[:=]/i.test(value) || value.includes('\0')) {
    throw UsageError(`${label} must be an opaque non-contact reference.`)
  }
}

const validatePlannedCost = (cost: { amounts: Array<{ amount: number, currency: string }> }, label: string): void => {
  assertAllowedKeys(cost, ['amounts'], label)
  if (!Array.isArray(cost.amounts)) throw UsageError(`${label} amounts must be an array.`)
  for (const amount of cost.amounts) {
    assertAllowedKeys(amount, ['amount', 'currency'], `${label} amount`)
    if (!Number.isFinite(amount.amount) || amount.amount < 0 || !amount.currency.trim()) throw UsageError(`${label} contains an invalid currency amount.`)
  }
}

const validateProtectedAsset = (asset: ProtectedAssetRef): void => {
  assertValidProtectedAssetRef(asset)
}

export const validateAuditActorRef = (actor: AuditActorRef): AuditActorRef => {
  assertAllowedKeys(actor, ['namespace', 'actorId'], 'Audit actor')
  if (!AUDIT_ACTOR_NAMESPACES.has(actor.namespace)) throw UsageError('Audit actor namespace must be local-user, project-role, or automation.')
  assertSafeKey(actor.actorId, 'Audit actor ID')
  return actor
}

export const computeConsentRecordId = (record: Omit<VoiceConsentRecord, 'consentRecordId'>): string =>
  hashCanonicalRecordWithout(record as unknown as Record<string, unknown>, [])

export const validateVoiceConsentRecord = (record: VoiceConsentRecord): VoiceConsentRecord => {
  assertAllowedKeys(record, ['schemaVersion', 'consentRecordId', 'subjectKey', 'provenanceRef', 'status', 'grants', 'evidence', 'recordedAt', 'recordedBy', 'revokedAt', 'revocationReason'], 'Voice consent record')
  if (record.schemaVersion !== 1) throw UsageError('Voice consent record requires schemaVersion 1.')
  assertContentIdentity(record as unknown as Record<string, unknown>, 'consentRecordId', 'Voice consent record')
  assertSubjectKey(record.subjectKey, 'Consent subject key')
  if (!['active', 'revoked', 'expired'].includes(record.status)) throw UsageError('Voice consent status is unsupported.')
  assertNonSecretReference(record.provenanceRef, 'Consent provenance reference')
  validateAuditActorRef(record.recordedBy)
  assertIsoDate(record.recordedAt, 'Consent recordedAt')
  if (record.evidence) validateProtectedAsset(record.evidence)
  if (!Array.isArray(record.grants)) throw UsageError('Voice consent grants must be an array.')
  assertUnique(record.grants.map(grant => grant.action), 'Voice consent grants')
  for (const grant of record.grants) {
    assertAllowedKeys(grant, ['action', 'allowed', 'expiresAt', 'obligationRef'], 'Voice consent grant')
    if (!CONSENT_ACTIONS.has(grant.action) || typeof grant.allowed !== 'boolean') throw UsageError('Voice consent grant has an unsupported action or non-Boolean decision.')
    if (grant.expiresAt) {
      assertIsoDate(grant.expiresAt, `Consent ${grant.action} expiry`)
      if (Date.parse(grant.expiresAt) <= Date.parse(record.recordedAt)) {
        throw UsageError(`Consent ${grant.action} expiry must follow recordedAt.`)
      }
    }
    if (grant.obligationRef) assertNonSecretReference(grant.obligationRef, `Consent ${grant.action} obligation`)
  }
  if (record.status === 'revoked') {
    if (!record.revokedAt || !record.revocationReason?.trim()) throw UsageError('Revoked consent requires revocation time and reason.')
    assertIsoDate(record.revokedAt, 'Consent revokedAt')
  } else if (record.revokedAt !== undefined || record.revocationReason !== undefined) {
    throw UsageError('Only revoked consent may contain revocation details.')
  }
  return record
}

export const assertVoiceConsentAllows = (
  record: VoiceConsentRecord | undefined,
  action: VoiceConsentAction,
  at = new Date()
): void => {
  if (!record) throw UsageError(`Voice consent is required for ${action}; absent permission defaults to deny.`)
  validateVoiceConsentRecord(record)
  if (record.status !== 'active') throw UsageError(`Voice consent is ${record.status}; ${action} is denied.`)
  const grant = record.grants.find(entry => entry.action === action)
  if (!grant?.allowed) throw UsageError(`Voice consent does not permit ${action}.`)
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= at.getTime()) {
    throw UsageError(`Voice consent for ${action} has expired.`)
  }
}

const validateProvisioningState = (state: VoiceProvisioningState): void => {
  const allowed = state.state === 'ready' ? ['state', 'providerVoice']
    : state.state === 'pending' ? ['state', 'operationId', 'providerVoice']
      : state.state === 'verification-required' || state.state === 'approval-required' ? ['state', 'operationId', 'action', 'providerVoice']
        : state.state === 'external-action-required' ? ['state', 'action', 'providerVoice']
          : state.state === 'reconciliation-required' ? ['state', 'attemptId', 'providerVoice', 'reason']
            : state.state === 'missing' ? ['state', 'providerVoice', 'reason']
              : state.state === 'expired' ? ['state', 'providerVoice']
                : state.state === 'deleted' ? ['state', 'providerVoice', 'deletedAt']
                  : state.state === 'failed' ? ['state', 'code', 'message', 'providerVoice']
                    : []
  if (allowed.length === 0) throw UsageError('Voice provisioning state is unsupported.')
  assertAllowedKeys(state, allowed, `Voice provisioning ${state.state} state`)
  if ('providerVoice' in state && state.providerVoice) validateProviderVoiceRef(state.providerVoice)
  if (state.state === 'ready' && !state.providerVoice) throw UsageError('Ready provisioning requires a provider voice.')
  if (state.state === 'reconciliation-required' && (!state.attemptId.trim() || !state.reason.trim())) {
    throw UsageError('Reconciliation-required provisioning needs attempt identity and reason.')
  }
  if (state.state === 'deleted') assertIsoDate(state.deletedAt, 'Voice provisioning deletedAt')
  if (state.state === 'failed' && (!state.code.trim() || !state.message.trim())) throw UsageError('Failed provisioning requires a code and sanitized message.')
}

export const validateVoiceProvisioningAttempt = (
  attempt: VoiceProvisioningAttempt
): VoiceProvisioningAttempt => {
  assertAllowedKeys(attempt, ['schemaVersion', 'attemptId', 'registrationDraftId', 'operation', 'accountScopeHash', 'lockLeaseId', 'requestFingerprint', 'protectedRequestEvidence', 'idempotencyKey', 'reconciliation', 'transitions', 'issuedResources', 'outcome', 'compareAndSwapVersion'], 'Voice provisioning attempt')
  if (attempt.schemaVersion !== 1) throw UsageError('Voice provisioning attempt requires schemaVersion 1.')
  if (!PROVISIONING_OPERATIONS.has(attempt.operation)) throw UsageError('Voice provisioning attempt has an unsupported operation.')
  for (const [value, label] of [
    [attempt.attemptId, 'Provisioning attempt ID'],
    [attempt.registrationDraftId, 'Registration draft ID'],
    [attempt.lockLeaseId, 'Provisioning lock lease ID']
  ] as const) assertSafeKey(value, label)
  assertSha256(attempt.accountScopeHash, 'Provisioning account scope hash')
  assertSha256(attempt.requestFingerprint, 'Provisioning request fingerprint')
  validateProtectedAsset(attempt.protectedRequestEvidence)
  if (attempt.reconciliation) {
    assertAllowedKeys(attempt.reconciliation, ['strategy', 'providerHandle', 'protectedLookupEvidence'], 'Voice provisioning reconciliation')
    if (!['provider-operation', 'idempotency-lookup', 'provider-search', 'manual-inspection'].includes(attempt.reconciliation.strategy)) throw UsageError('Voice provisioning reconciliation strategy is unsupported.')
    validateProtectedAsset(attempt.reconciliation.protectedLookupEvidence)
    if (attempt.reconciliation.providerHandle !== undefined && !attempt.reconciliation.providerHandle.trim()) {
      throw UsageError('Provisioning reconciliation provider handle cannot be blank.')
    }
  }
  if (!Number.isInteger(attempt.compareAndSwapVersion) || attempt.compareAndSwapVersion < 0) {
    throw UsageError('Provisioning compare-and-swap version must be a non-negative integer.')
  }
  if (!Array.isArray(attempt.transitions) || !Array.isArray(attempt.issuedResources)) throw UsageError('Provisioning transitions and issued resources must be arrays.')
  if (attempt.transitions.length === 0 || attempt.transitions[0]?.phase !== 'prepared') {
    throw UsageError('Provisioning transitions must begin with prepared.')
  }
  const phases = attempt.transitions.map(transition => transition.phase)
  for (const [index, transition] of attempt.transitions.entries()) {
    assertAllowedKeys(transition, ['sequence', 'phase', 'at', 'evidenceHash'], 'Voice provisioning transition')
    if (!['prepared', 'request-sent', 'response-received', 'ambiguous', 'reconciled', 'terminal'].includes(transition.phase)) throw UsageError('Voice provisioning transition phase is unsupported.')
    if (transition.sequence !== index + 1) throw UsageError('Provisioning transitions require contiguous one-based sequence numbers.')
    assertIsoDate(transition.at, `Provisioning ${transition.phase} transition`)
    if (transition.evidenceHash) assertSha256(transition.evidenceHash, `Provisioning ${transition.phase} evidence hash`)
  }
  if (phases.filter(phase => phase === 'request-sent').length > 1) throw UsageError('Provisioning attempt cannot send its create request more than once.')
  if (phases.includes('response-received') && !phases.includes('request-sent')) throw UsageError('Provisioning response requires a prior request.')
  if (phases.includes('ambiguous') && !phases.includes('request-sent')) throw UsageError('Ambiguous provisioning requires a prior request.')
  if (phases.includes('reconciled') && !phases.includes('ambiguous')) throw UsageError('Provisioning reconciliation requires a prior ambiguous outcome.')
  if (phases.includes('terminal') && attempt.outcome === undefined) throw UsageError('Terminal provisioning requires an outcome.')
  if (attempt.outcome !== undefined) validateProvisioningState(attempt.outcome)
  assertUnique(attempt.issuedResources.map(resource => `${resource.providerVoice.provider}\0${resource.providerVoice.kind === 'remote-resource' ? resource.providerVoice.resourceId : JSON.stringify(resource.providerVoice)}`), 'Provisioning issued resources')
  for (const resource of attempt.issuedResources) {
    assertAllowedKeys(resource, ['providerVoice', 'observedAt', 'sanitizedResponseHash'], 'Voice issued resource')
    validateProviderVoiceRef(resource.providerVoice)
    assertIsoDate(resource.observedAt, 'Issued resource observedAt')
    assertSha256(resource.sanitizedResponseHash, 'Issued resource response hash')
  }
  const outcomeVoice = attempt.outcome && 'providerVoice' in attempt.outcome ? attempt.outcome.providerVoice : undefined
  if (outcomeVoice && outcomeVoice.kind === 'remote-resource' && !attempt.issuedResources.some(resource =>
    resource.providerVoice.kind === 'remote-resource'
    && resource.providerVoice.provider === outcomeVoice.provider
    && resource.providerVoice.resourceId === outcomeVoice.resourceId
  )) {
    throw UsageError('Provisioning outcome resource must first be retained in issuedResources.')
  }
  return attempt
}

export const computeVoiceAuditionId = (manifest: Omit<VoiceAuditionManifest, 'auditionId'>): string =>
  hashCanonicalRecordWithout(manifest as unknown as Record<string, unknown>, [])

export const computeVoiceCandidateId = (candidate: Omit<VoiceCandidate, 'candidateId'>): string =>
  hashCanonicalRecordWithout(candidate as unknown as Record<string, unknown>, [])

export const validateVoiceCandidate = (candidate: VoiceCandidate): VoiceCandidate => {
  assertAllowedKeys(candidate, ['schemaVersion', 'candidateId', 'registrationDraftId', 'provider', 'providerModel', 'providerCandidateId', 'creationModel', 'operation', 'sourceIdentityHash', 'sourceVoice', 'eligibilitySnapshotHash', 'description', 'previewAssets', 'plannedCost', 'expiresAt', 'expiryState', 'createdAt', 'materialization'], 'Voice candidate')
  if (candidate.schemaVersion !== 1) throw UsageError('Voice candidate requires schemaVersion 1.')
  assertContentIdentity(candidate as unknown as Record<string, unknown>, 'candidateId', 'Voice candidate')
  assertSafeKey(candidate.registrationDraftId, 'Candidate registration draft ID')
  if (candidate.providerCandidateId !== undefined && !candidate.providerCandidateId.trim()) throw UsageError('Voice candidate provider ID cannot be empty.')
  if (!TTS_PROVIDERS.has(candidate.provider)) throw UsageError('Voice candidate has an unsupported provider.')
  assertSha256(candidate.sourceIdentityHash, 'Candidate source identity hash')
  if (candidate.sourceVoice) {
    validateProviderVoiceRef(candidate.sourceVoice)
    if (candidate.sourceVoice.provider !== candidate.provider) throw UsageError('Voice candidate source voice belongs to another provider.')
  }
  if (candidate.operation === 'remix') {
    if (!candidate.sourceVoice || !candidate.eligibilitySnapshotHash) throw UsageError('Remix candidate requires source voice and eligibility snapshot identity.')
    assertSha256(candidate.eligibilitySnapshotHash, 'Remix eligibility snapshot hash')
  } else if (candidate.sourceVoice || candidate.eligibilitySnapshotHash) throw UsageError('Only remix candidates may carry remix source eligibility.')
  assertIsoDate(candidate.createdAt, 'Candidate createdAt')
  if (!candidate.providerModel.trim()) throw UsageError('Voice candidate requires a provider model.')
  if (!PROVISIONING_OPERATIONS.has(candidate.operation)) throw UsageError('Voice candidate has an unsupported operation.')
  if (!Array.isArray(candidate.previewAssets)) throw UsageError('Voice candidate preview assets must be an array.')
  validatePlannedCost(candidate.plannedCost, 'Voice candidate planned cost')
  for (const preview of candidate.previewAssets) validateProtectedAsset(preview)
  assertUnique(candidate.previewAssets.map(preview => `${preview.storeId}\0${preview.assetId}`), 'Voice candidate preview assets')
  if (candidate.expiryState === 'known') {
    if (!candidate.expiresAt) throw UsageError('A voice candidate with known expiry requires expiresAt.')
    assertIsoDate(candidate.expiresAt, 'Candidate expiresAt')
    if (Date.parse(candidate.expiresAt) <= Date.parse(candidate.createdAt)) throw UsageError('Voice candidate expiry must follow its creation time.')
  } else if (candidate.expiresAt !== undefined) {
    throw UsageError('Voice candidate expiresAt is valid only when expiryState is known.')
  }
  if (candidate.materialization.state === 'materialized') {
    assertAllowedKeys(candidate.materialization, ['state', 'attemptId', 'providerVoice'], 'Materialized voice candidate')
    assertSafeKey(candidate.materialization.attemptId, 'Candidate materialization attempt ID')
    validateProviderVoiceRef(candidate.materialization.providerVoice)
    if (candidate.materialization.providerVoice.provider !== candidate.provider) throw UsageError('Materialized candidate voice provider does not match its candidate.')
  } else if (candidate.materialization.state === 'blocked') {
    assertAllowedKeys(candidate.materialization, ['state', 'error'], 'Blocked voice candidate')
    if (!candidate.materialization.error.code.trim() || !candidate.materialization.error.message.trim()) throw UsageError('Blocked candidate materialization requires a sanitized error.')
  } else if (candidate.materialization.state === 'not-materialized') {
    assertAllowedKeys(candidate.materialization, ['state'], 'Unmaterialized voice candidate')
  } else {
    throw UsageError('Voice candidate has an unsupported materialization state.')
  }
  return candidate
}

export const validateVoiceAuditionManifest = (manifest: VoiceAuditionManifest): VoiceAuditionManifest => {
  assertAllowedKeys(manifest, ['schemaVersion', 'auditionId', 'registrationDraftId', 'provider', 'providerModel', 'providerVoice', 'capabilityFixtureHash', 'settingsSchema', 'synthesisSettings', 'items', 'plannedCost', 'warnings', 'createdAt'], 'Voice audition manifest')
  if (manifest.schemaVersion !== 1) throw UsageError('Voice audition manifest requires schemaVersion 1.')
  assertContentIdentity(manifest as unknown as Record<string, unknown>, 'auditionId', 'Voice audition manifest')
  assertSafeKey(manifest.registrationDraftId, 'Audition registration draft ID')
  if (!TTS_PROVIDERS.has(manifest.provider)) throw UsageError('Voice audition has an unsupported provider.')
  assertSha256(manifest.capabilityFixtureHash, 'Audition capability fixture hash')
  validateProviderVoiceRef(manifest.providerVoice)
  if (manifest.providerVoice.provider !== manifest.provider) throw UsageError('Audition voice provider does not match its target provider.')
  if (manifest.settingsSchema !== manifest.synthesisSettings.settingsSchema) throw UsageError('Audition settings schema does not match its settings payload.')
  assertIsoDate(manifest.createdAt, 'Audition createdAt')
  if (!Array.isArray(manifest.items) || !Array.isArray(manifest.warnings) || manifest.warnings.some(warning => typeof warning !== 'string')) throw UsageError('Voice audition items and warnings must be arrays.')
  validatePlannedCost(manifest.plannedCost, 'Voice audition planned cost')
  assertUnique(manifest.items.map(item => item.itemId), 'Audition item IDs')
  for (const category of AUDITION_REQUIRED_CATEGORIES) {
    if (!manifest.items.some(item => item.category === category)) throw UsageError(`Canonical audition is missing required ${category} coverage.`)
  }
  for (const item of manifest.items) {
    assertAllowedKeys(item, ['itemId', 'category', 'canonicalText', 'providerText', 'delivery', 'takes', 'selectedTakeId'], 'Voice audition item')
    assertSafeKey(item.itemId, 'Audition item ID')
    if (!Array.isArray(item.takes) || !item.canonicalText.trim() || !item.providerText.trim() || item.takes.length === 0) throw UsageError('Audition items require canonical/provider text and at least one take.')
    if (!['neutral', 'representative', 'emotional-delivery', 'pronunciation', 'comparison'].includes(item.category)) throw UsageError('Voice audition item has an unsupported category.')
    assertUnique(item.takes.map(take => take.takeId), `Audition ${item.itemId} take IDs`)
    const selected = item.takes.find(take => take.takeId === item.selectedTakeId)
    if (!selected) throw UsageError(`Audition ${item.itemId} selected take is missing.`)
    for (const take of item.takes) {
      assertAllowedKeys(take, ['takeId', 'protectedAudio', 'sha256', 'durationMs', 'providerGenerationId', 'cost', 'warnings'], 'Voice audition take')
      assertSafeKey(take.takeId, 'Audition take ID')
      validateProtectedAsset(take.protectedAudio)
      if (take.sha256 !== take.protectedAudio.sha256) throw UsageError('Audition take checksum must equal its protected asset checksum.')
      if (!Array.isArray(take.warnings) || take.warnings.some(warning => typeof warning !== 'string')) throw UsageError('Voice audition take warnings must be strings.')
      validatePlannedCost(take.cost, 'Voice audition take cost')
      if (take.durationMs !== undefined && (!Number.isFinite(take.durationMs) || take.durationMs <= 0)) throw UsageError('Audition take duration must be positive when present.')
    }
  }
  return manifest
}

const validateVoiceRegistrationIdentity = (registration: VoiceRegistration): void => {
  assertAllowedKeys(registration, ['schemaVersion', 'registrationId', 'generationId', 'priorGenerationId', 'subjectKey', 'profileKey', 'provider', 'providerModel', 'creationModel', 'briefHash', 'provenanceRef', 'consentRecordRef', 'settingsSchema', 'synthesisSettings', 'capabilityFixtureHash', 'accountCapabilityObservationHash', 'sanitizedProviderMetadata', 'retention', 'cleanupState', 'createdAt', 'updatedAt', 'approval', 'provisioning', 'approvedAuditionId'], 'Voice registration')
  if (registration.schemaVersion !== 1) throw UsageError('Voice registration requires schemaVersion 1.')
  assertSafeKey(registration.registrationId, 'Voice registration ID')
  assertContentIdentity(registration as unknown as Record<string, unknown>, 'generationId', 'Voice registration generation')
  if (registration.priorGenerationId) assertSha256(registration.priorGenerationId, 'Prior voice generation ID')
  assertSubjectKey(registration.subjectKey, 'Voice registration subject key')
  assertSafeKey(registration.profileKey, 'Voice registration profile key')
  if (!TTS_PROVIDERS.has(registration.provider)) throw UsageError('Voice registration has an unsupported provider.')
  assertSha256(registration.briefHash, 'Voice registration brief hash')
  assertSha256(registration.capabilityFixtureHash, 'Voice registration capability fixture hash')
  if (registration.accountCapabilityObservationHash) assertSha256(registration.accountCapabilityObservationHash, 'Voice account observation hash')
  assertNonSecretReference(registration.provenanceRef, 'Voice registration provenance reference')
  if (registration.consentRecordRef) {
    assertNonSecretReference(registration.consentRecordRef, 'Voice registration consent reference')
    if (!/^protected-consent:v1:[a-z0-9][a-z0-9_-]{0,127}:sha256_[a-f0-9]{64}:[a-f0-9]{64}$/.test(registration.consentRecordRef)) throw UsageError('Voice registration consent reference must be a protected consent v1 locator.')
  }
}

const validateVoiceRegistrationSettings = (registration: VoiceRegistration): void => {
  if (registration.settingsSchema !== registration.synthesisSettings.settingsSchema) throw UsageError('Voice registration settings schema does not match its settings payload.')
  assertAllowedKeys(registration.synthesisSettings, ['schemaVersion', 'settingsSchema', 'values'], 'Voice registration synthesis settings')
  if (registration.synthesisSettings.schemaVersion !== 1) throw UsageError('Voice registration synthesis settings require schemaVersion 1.')
  if (typeof registration.synthesisSettings.values !== 'object' || registration.synthesisSettings.values === null || Array.isArray(registration.synthesisSettings.values)) throw UsageError('Voice registration synthesis settings values must be an object.')
  for (const [key, value] of Object.entries(registration.synthesisSettings.values)) {
    if (!key.trim() || !(value === null || ['string', 'number', 'boolean'].includes(typeof value) || (Array.isArray(value) && value.every(entry => typeof entry === 'string')))) throw UsageError('Voice registration synthesis settings contain an unsupported value.')
  }
  if (typeof registration.sanitizedProviderMetadata !== 'object' || registration.sanitizedProviderMetadata === null || Array.isArray(registration.sanitizedProviderMetadata)) throw UsageError('Voice registration provider metadata must be an object.')
  for (const value of Object.values(registration.sanitizedProviderMetadata)) {
    if (!(value === null || ['string', 'number', 'boolean'].includes(typeof value) || (Array.isArray(value) && value.every(entry => typeof entry === 'string')))) throw UsageError('Voice registration provider metadata contains an unsupported value.')
  }
}

const validateVoiceRetentionAndCleanup = (registration: VoiceRegistration): void => {
  assertAllowedKeys(registration.retention, ['protectedAssets', 'providerResource', 'cacheAfterRevocation', 'exportAfterRevocation', 'obligationRef'], 'Voice retention policy')
  if (!['retain', 'delete-on-revocation', 'delete-after-provisioning'].includes(registration.retention.protectedAssets)
    || !['retain', 'delete-on-retirement', 'external'].includes(registration.retention.providerResource)
    || !['deny', 'allow-existing'].includes(registration.retention.cacheAfterRevocation)
    || !['deny', 'allow-existing'].includes(registration.retention.exportAfterRevocation)) throw UsageError('Voice retention policy contains an unsupported decision.')
  if (registration.retention.obligationRef) assertNonSecretReference(registration.retention.obligationRef, 'Voice retention obligation reference')
  const cleanupAllowed = registration.cleanupState.state === 'retained' ? ['state', 'checkedAt']
    : registration.cleanupState.state === 'deletion-required' ? ['state', 'reason', 'requiredAt']
      : registration.cleanupState.state === 'deletion-pending' ? ['state', 'requestedAt']
        : registration.cleanupState.state === 'deleted' ? ['state', 'deletedAt']
          : registration.cleanupState.state === 'external-action-required' ? ['state', 'action', 'checkedAt'] : []
  if (cleanupAllowed.length === 0) throw UsageError('Voice cleanup state is unsupported.')
  assertAllowedKeys(registration.cleanupState, cleanupAllowed, 'Voice cleanup state')
  if (registration.cleanupState.state === 'retained') assertIsoDate(registration.cleanupState.checkedAt, 'Voice cleanup checkedAt')
  if (registration.cleanupState.state === 'deletion-required') assertIsoDate(registration.cleanupState.requiredAt, 'Voice cleanup requiredAt')
  if (registration.cleanupState.state === 'deletion-pending') assertIsoDate(registration.cleanupState.requestedAt, 'Voice cleanup requestedAt')
  if (registration.cleanupState.state === 'deleted') assertIsoDate(registration.cleanupState.deletedAt, 'Voice cleanup deletedAt')
  if (registration.cleanupState.state === 'external-action-required') assertIsoDate(registration.cleanupState.checkedAt, 'Voice cleanup checkedAt')
}

const validateVoiceApproval = (registration: VoiceRegistration): void => {
  const approvalAllowed = registration.approval.state === 'approved' ? ['state', 'auditionId', 'approvedAt', 'approvedBy']
    : registration.approval.state === 'draft' ? ['state']
      : registration.approval.state === 'auditioned' ? ['state', 'auditionId']
        : registration.approval.state === 'retired' ? ['state', 'priorAuditionId', 'retiredAt']
          : registration.approval.state === 'revoked' ? ['state', 'priorAuditionId', 'revokedAt', 'reason'] : []
  if (approvalAllowed.length === 0) throw UsageError('Voice approval state is unsupported.')
  assertAllowedKeys(registration.approval, approvalAllowed, 'Voice approval state')
  if (registration.approval.state === 'approved') {
    if (registration.provisioning.state !== 'ready') throw UsageError('Approved voice registration must be provisioned and ready.')
    if (registration.approvedAuditionId !== registration.approval.auditionId) throw UsageError('Approved voice registration must bind its exact approval audition.')
    assertSha256(registration.approvedAuditionId, 'Approved audition ID')
    assertIsoDate(registration.approval.approvedAt, 'Voice registration approvedAt')
    validateAuditActorRef(registration.approval.approvedBy)
  } else if (registration.approvedAuditionId !== undefined) throw UsageError('Only an approved registration may contain approvedAuditionId.')
  if (registration.approval.state === 'auditioned') assertSha256(registration.approval.auditionId, 'Voice audition ID')
  if (registration.approval.state === 'retired') assertIsoDate(registration.approval.retiredAt, 'Voice registration retiredAt')
  if (registration.approval.state === 'revoked') {
    assertIsoDate(registration.approval.revokedAt, 'Voice registration revokedAt')
    if (!registration.approval.reason.trim()) throw UsageError('Revoked voice registration requires a reason.')
  }
}

export const validateVoiceRegistration = (registration: VoiceRegistration): VoiceRegistration => {
  validateVoiceRegistrationIdentity(registration)
  validateVoiceRegistrationSettings(registration)
  validateVoiceRetentionAndCleanup(registration)
  assertIsoDate(registration.createdAt, 'Voice registration createdAt')
  assertIsoDate(registration.updatedAt, 'Voice registration updatedAt')
  validateProvisioningState(registration.provisioning)
  if ('providerVoice' in registration.provisioning && registration.provisioning.providerVoice && registration.provisioning.providerVoice.provider !== registration.provider) throw UsageError('Voice registration provisioning provider does not match the registration provider.')
  validateVoiceApproval(registration)
  return registration
}

export const validateVoiceRegistrationCatalog = (catalog: VoiceRegistrationCatalog): VoiceRegistrationCatalog => {
  assertAllowedKeys(catalog, ['schemaVersion', 'registrations'], 'Voice registration catalog')
  if (catalog.schemaVersion !== 1) throw UsageError('Voice registration catalog requires schemaVersion 1.')
  if (!Array.isArray(catalog.registrations)) throw UsageError('Voice registration catalog registrations must be an array.')
  const identities = catalog.registrations.map(registration => `${registration.registrationId}\0${registration.generationId}`)
  assertUnique(identities, 'Voice registration generations')
  const rootRegistrationIds = catalog.registrations.filter(registration => registration.priorGenerationId === undefined).map(registration => registration.registrationId)
  assertUnique(rootRegistrationIds, 'Voice registration roots')
  for (const registration of catalog.registrations) validateVoiceRegistration(registration)
  for (const registration of catalog.registrations) {
    if (registration.priorGenerationId) {
      const prior = catalog.registrations.find(candidate => candidate.generationId === registration.priorGenerationId)
      if (!prior) throw UsageError('Voice registration prior generation is missing from the append-preserving catalog.')
      if (prior.registrationId !== registration.registrationId) throw UsageError('Voice registration prior generation belongs to a different registration chain.')
    }
  }
  const successorIds = catalog.registrations.flatMap(registration => registration.priorGenerationId ? [registration.priorGenerationId] : [])
  assertUnique(successorIds, 'Voice registration generation successors')
  return catalog
}

export const validateCurrentVoiceRegistrationIndex = (
  index: CurrentVoiceRegistrationIndex,
  catalog?: VoiceRegistrationCatalog | undefined
): CurrentVoiceRegistrationIndex => {
  assertAllowedKeys(index, ['schemaVersion', 'revision', 'selections'], 'Current voice registration index')
  if (index.schemaVersion !== 2 || !Number.isInteger(index.revision) || index.revision < 0) throw UsageError('Current voice index requires schemaVersion 2 and a non-negative revision.')
  if (!Array.isArray(index.selections)) throw UsageError('Current voice index selections must be an array.')
  assertUnique(index.selections.map(selection => `${selection.subjectKey}\0${selection.provider}\0${selection.providerModel}\0${selection.profileKey}`), 'Current voice selection keys')
  for (const selection of index.selections) {
    assertAllowedKeys(selection, ['subjectKey', 'provider', 'providerModel', 'profileKey', 'registrationId', 'generationId', 'updatedAt'], 'Current voice registration selection')
    assertSubjectKey(selection.subjectKey, 'Current voice subject key')
    assertSafeKey(selection.profileKey, 'Current voice profile key')
    if (!TTS_PROVIDERS.has(selection.provider)) throw UsageError('Current voice selection has an unsupported provider.')
    if (!selection.providerModel.trim()) throw UsageError('Current voice selection requires a provider model.')
    assertSafeKey(selection.registrationId, 'Current voice registration ID')
    assertSha256(selection.generationId, 'Current voice generation ID')
    assertIsoDate(selection.updatedAt, 'Current voice selection updatedAt')
    if (catalog) {
      const registration = catalog.registrations.find(candidate =>
        candidate.registrationId === selection.registrationId
        && candidate.generationId === selection.generationId
      )
      if (!registration || registration.approval.state !== 'approved' || registration.provisioning.state !== 'ready') {
        throw UsageError('Current voice selection must resolve to one approved ready registration generation.')
      }
      if (registration.subjectKey !== selection.subjectKey || registration.provider !== selection.provider || registration.providerModel !== selection.providerModel || registration.profileKey !== selection.profileKey) {
        throw UsageError('Current voice selection identity does not match its registration generation.')
      }
    }
  }
  return index
}
