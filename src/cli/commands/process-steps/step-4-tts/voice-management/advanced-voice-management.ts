import { randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type {
  CharacterVoiceBrief,
  PlannedCost,
  ProviderVoiceCloneRequest,
  ProviderVoiceMutationResult,
  TtsVoiceProvider,
  VoiceCandidate,
  VoiceConsentRecord,
  VoiceProvisioningAttempt,
  VoiceRegistration,
  ProtectedVoiceAssetStore,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTtsJson, hashCanonicalRecordWithout, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { appendVoiceRegistration, hashCharacterVoiceBrief } from './character-voice-registry'
import { buildReadyVoiceRegistrationDraft } from './voice-registration-management'
import { DEFAULT_VOICE_RETENTION_POLICY } from './voice-registration-management'
import { computeVoiceCandidateId, validateVoiceCandidate } from './voice-management-contracts'
import { runCrashSafeVoiceProvisioning } from './provisioning-journal'

const EMPTY_COST: PlannedCost = { amounts: [] }
const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,127}$/

const candidateRoot = (charactersRoot: string): string => join(resolve(charactersRoot), 'voice-candidates')
const candidatePath = (charactersRoot: string, candidateId: string): string => {
  if (!SAFE_ID.test(candidateId)) throw CLIUsageError('Voice candidate ID must be an opaque lowercase identifier.')
  return join(candidateRoot(charactersRoot), `${candidateId}.json`)
}

const writeCreateOnlyJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  const bytes = `${canonicalTtsJson(value)}\n`
  const file = Bun.file(path)
  if (await file.exists()) {
    if (await file.text() !== bytes) throw CLIUsageError('Voice candidate artifact identity collision detected.')
    return
  }
  await Bun.write(path, bytes)
}

export const writeVoiceCandidate = async (charactersRoot: string, candidate: VoiceCandidate): Promise<string> => {
  validateVoiceCandidate(candidate)
  const path = candidatePath(charactersRoot, candidate.candidateId)
  await writeCreateOnlyJson(path, candidate)
  return path
}

export const loadVoiceCandidate = async (charactersRoot: string, candidateId: string): Promise<VoiceCandidate> => {
  let value: unknown
  try { value = JSON.parse(await readFile(candidatePath(charactersRoot, candidateId), 'utf8')) }
  catch { throw CLIUsageError(`Voice candidate ${candidateId} was not found or is corrupt.`) }
  return validateVoiceCandidate(value as VoiceCandidate)
}

const requireDesignPort = (provider: Pick<TtsVoiceProvider, 'provider' | 'design'>) => {
  if (!provider.design) throw CLIUsageError(`Provider ${provider.provider} does not implement Voice Design.`)
  return provider.design
}

export const createAdvancedVoiceCandidates = async (input: {
  charactersRoot: string
  protectedStore: ProtectedVoiceAssetStore
  provider: Pick<TtsVoiceProvider, 'provider' | 'design'>
  providerModel: string
  creationModel: string
  subjectKey: string
  profileKey: string
  description: string
  previewText: string
  candidateCount: number
  sourceVoice?: Parameters<NonNullable<TtsVoiceProvider['design']>['createCandidate']>[0]['sourceVoice'] | undefined
  eligibilitySnapshotHash?: string | undefined
  seed?: number | undefined
  plannedCost?: PlannedCost | undefined
  now?: (() => string) | undefined
}): Promise<VoiceCandidate[]> => {
  if (!input.protectedStore.storeBytes) throw CLIUsageError('Managed protected store cannot retain candidate previews.')
  const now = input.now ?? (() => new Date().toISOString())
  const design = requireDesignPort(input.provider)
  const result = await design.createCandidate({
    description: input.description,
    previewText: input.previewText,
    candidateCount: input.candidateCount,
    creationModel: input.creationModel,
    ...(input.sourceVoice ? { sourceVoice: input.sourceVoice } : {}),
    ...(input.eligibilitySnapshotHash ? { eligibilitySnapshotHash: input.eligibilitySnapshotHash } : {}),
    ...(typeof input.seed === 'number' ? { seed: input.seed } : {})
  })
  const createdAt = now()
  const sourceIdentityHash = hashCanonicalTtsValue({
    provider: input.provider.provider,
    input: {
      description: input.description,
      previewText: input.previewText,
      ...(input.sourceVoice ? { sourceVoice: input.sourceVoice } : {}),
      ...(input.eligibilitySnapshotHash ? { eligibilitySnapshotHash: input.eligibilitySnapshotHash } : {})
    }
  })
  const candidates: VoiceCandidate[] = []
  for (const preview of result.previews) {
    const previewBytes = Uint8Array.from(Buffer.from(preview.audioBase64, 'base64'))
    if (previewBytes.byteLength === 0) throw CLIUsageError(`${input.provider.provider} returned an empty candidate preview.`)
    const previewAsset = await input.protectedStore.storeBytes(previewBytes, {
      schemaVersion: 1,
      purpose: 'candidate-preview',
      authorizationRef: `voice-candidate:${input.subjectKey}`,
      retention: { mode: 'retain-until-revoked' },
      createdAt
    })
    const registrationDraftId = `vr_${hashCanonicalTtsValue({ subjectKey: input.subjectKey, profileKey: input.profileKey, provider: input.provider.provider, providerCandidateId: preview.providerCandidateId }).slice(0, 40)}`
    const withoutId = {
      schemaVersion: 1 as const,
      registrationDraftId,
      provider: input.provider.provider,
      providerModel: input.providerModel,
      providerCandidateId: preview.providerCandidateId,
      creationModel: input.creationModel,
      operation: result.operation,
      sourceIdentityHash,
      ...(input.sourceVoice ? { sourceVoice: input.sourceVoice } : {}),
      ...(input.eligibilitySnapshotHash ? { eligibilitySnapshotHash: input.eligibilitySnapshotHash } : {}),
      description: input.description,
      previewAssets: [previewAsset],
      plannedCost: input.plannedCost ?? EMPTY_COST,
      ...(preview.expiresAt ? { expiresAt: preview.expiresAt } : {}),
      expiryState: preview.expiresAt ? 'known' as const : 'not-exposed' as const,
      createdAt,
      materialization: { state: 'not-materialized' as const }
    }
    const candidate = validateVoiceCandidate({ ...withoutId, candidateId: computeVoiceCandidateId(withoutId) })
    await writeVoiceCandidate(input.charactersRoot, candidate)
    candidates.push(candidate)
  }
  return candidates
}

const createAttempt = (input: {
  candidate: VoiceCandidate
  accountScopeHash: string
  protectedEvidence: VoiceProvisioningAttempt['protectedRequestEvidence']
  requestFingerprint: string
  now: string
  providerHandle?: string | undefined
}): VoiceProvisioningAttempt => {
  const attemptId = `vp_${hashCanonicalTtsValue({ candidateId: input.candidate.candidateId, operation: input.candidate.operation }).slice(0, 40)}`
  const base = {
    schemaVersion: 1 as const,
    attemptId,
    registrationDraftId: input.candidate.registrationDraftId,
    operation: input.candidate.operation,
    accountScopeHash: input.accountScopeHash,
    lockLeaseId: `lease_${hashCanonicalTtsValue({ attemptId, accountScopeHash: input.accountScopeHash }).slice(0, 32)}`,
    requestFingerprint: input.requestFingerprint,
    protectedRequestEvidence: input.protectedEvidence,
    reconciliation: input.providerHandle
      ? { strategy: 'provider-search' as const, providerHandle: input.providerHandle, protectedLookupEvidence: input.protectedEvidence }
      : { strategy: 'provider-operation' as const, protectedLookupEvidence: input.protectedEvidence },
    transitions: [{ sequence: 1, phase: 'prepared' as const, at: input.now }],
    issuedResources: [],
    compareAndSwapVersion: 0
  }
  return { ...base }
}

export const materializeAdvancedVoiceCandidate = async (input: {
  charactersRoot: string
  journalRoot: string
  protectedStore: ProtectedVoiceAssetStore
  provider: Pick<TtsVoiceProvider, 'provider' | 'design'> & { accountScopeHash: string }
  candidateId: string
  desiredName: string
  subjectKey: string
  profileKey: string
  brief: CharacterVoiceBrief
  provenanceRef: string
  consent?: VoiceConsentRecord | undefined
  consentRecordRef?: string | undefined
  capabilityFixtureHash: string
  sourceVoice?: Parameters<NonNullable<TtsVoiceProvider['design']>['materializeCandidate']>[0]['sourceVoice'] | undefined
  eligibilitySnapshotHash?: string | undefined
  now?: (() => string) | undefined
}): Promise<{ candidate: VoiceCandidate, registration: VoiceRegistration, attempt: VoiceProvisioningAttempt }> => {
  if (!input.protectedStore.storeBytes) throw CLIUsageError('Managed protected store cannot retain provisioning evidence.')
  const candidate = await loadVoiceCandidate(input.charactersRoot, input.candidateId)
  if (candidate.provider !== input.provider.provider || candidate.materialization.state !== 'not-materialized') throw CLIUsageError('Voice candidate is not an unmaterialized candidate for this provider.')
  if (canonicalTtsJson(candidate.sourceVoice ?? null) !== canonicalTtsJson(input.sourceVoice ?? null) || candidate.eligibilitySnapshotHash !== input.eligibilitySnapshotHash) {
    throw CLIUsageError('Voice candidate materialization must retain the exact source voice and eligibility snapshot captured at candidate creation.')
  }
  const now = input.now ?? (() => new Date().toISOString())
  const evidence = await input.protectedStore.storeBytes(Buffer.from(canonicalTtsJson({
    candidateId: candidate.candidateId,
    desiredName: input.desiredName,
    ...(input.sourceVoice ? { sourceVoice: input.sourceVoice } : {}),
    ...(input.eligibilitySnapshotHash ? { eligibilitySnapshotHash: input.eligibilitySnapshotHash } : {})
  })), {
    schemaVersion: 1, purpose: 'reconciliation-evidence', authorizationRef: `voice-materialization:${candidate.registrationDraftId}`,
    retention: { mode: 'retain-until-revoked' }, createdAt: now()
  })
  const initial = createAttempt({
    candidate,
    accountScopeHash: input.provider.accountScopeHash,
    protectedEvidence: evidence,
    requestFingerprint: hashCanonicalTtsValue({ candidateId: candidate.candidateId, registrationDraftId: candidate.registrationDraftId, desiredName: input.desiredName, sourceVoice: input.sourceVoice ?? null, eligibilitySnapshotHash: input.eligibilitySnapshotHash ?? null }),
    now: now(),
    ...(input.provider.provider === 'fish' ? { providerHandle: input.desiredName } : {}),
  })
  const design = requireDesignPort(input.provider)
  const attempt = await runCrashSafeVoiceProvisioning({
    journalRoot: input.journalRoot,
    attempt: initial,
    mutate: async () => {
      if (!candidate.providerCandidateId) throw CLIUsageError('Advanced voice candidate omits its provider candidate ID.')
      const result = await design.materializeCandidate({
        providerCandidateId: candidate.providerCandidateId,
        desiredName: input.desiredName,
        localAttemptId: initial.attemptId,
        ...(candidate.previewAssets[0] ? { protectedPreview: candidate.previewAssets[0] } : {}),
        ...(input.sourceVoice ? { sourceVoice: input.sourceVoice } : {}),
        ...(input.eligibilitySnapshotHash ? { eligibilitySnapshotHash: input.eligibilitySnapshotHash } : {})
      })
      if (result.state !== 'ready' || !result.providerVoice) throw CLIUsageError(`${input.provider.provider} candidate materialization did not return a ready provider voice.`)
      return {
        state: { state: 'ready' as const, providerVoice: result.providerVoice },
        issuedResources: [{ providerVoice: result.providerVoice, observedAt: result.checkedAt, sanitizedResponseHash: hashCanonicalTtsValue(result.sanitizedMetadata) }],
        evidenceHash: hashCanonicalTtsValue(result)
      }
    }
  })
  if (attempt.outcome?.state !== 'ready') throw CLIUsageError('Voice candidate materialization did not reach a ready state.')
  const { candidateId: _priorCandidateId, ...candidateWithoutId } = candidate
  const materializedWithoutId: Omit<VoiceCandidate, 'candidateId'> = { ...candidateWithoutId, materialization: { state: 'materialized', attemptId: attempt.attemptId, providerVoice: attempt.outcome.providerVoice } }
  const materialized = validateVoiceCandidate({ ...materializedWithoutId, candidateId: computeVoiceCandidateId(materializedWithoutId) })
  await writeVoiceCandidate(input.charactersRoot, materialized)
  const registration = buildReadyVoiceRegistrationDraft({
    registrationId: candidate.registrationDraftId,
    subjectKey: input.subjectKey,
    profileKey: input.profileKey,
    provider: input.provider.provider,
    providerModel: candidate.providerModel,
    ...(candidate.creationModel ? { creationModel: candidate.creationModel } : {}),
    providerVoice: attempt.outcome.providerVoice,
    brief: input.brief,
    provenanceRef: input.provenanceRef,
    ...(input.consent ? { consent: input.consent, consentRecordRef: input.consentRecordRef } : {}),
    capabilityFixtureHash: input.capabilityFixtureHash,
    sanitizedProviderMetadata: { candidateId: candidate.candidateId, attemptId: attempt.attemptId, briefHash: hashCharacterVoiceBrief(input.brief), desiredName: input.desiredName }
  })
  await appendVoiceRegistration(input.charactersRoot, registration)
  return { candidate: materialized, registration, attempt }
}

export const planAdvancedClone = (request: ProviderVoiceCloneRequest): { estimatedCostCents: 0, requestFingerprint: string } => ({
  estimatedCostCents: 0,
  requestFingerprint: hashCanonicalTtsValue({ ...request, protectedSamples: request.protectedSamples.map(sample => sample.sha256) })
})

const cloneProvisioningState = (result: ProviderVoiceMutationResult, attemptId: string): VoiceRegistration['provisioning'] => {
  if (result.state === 'ready') {
    if (!result.providerVoice) throw CLIUsageError('Ready voice clone response omits the provider voice identity.')
    return { state: 'ready', providerVoice: result.providerVoice }
  }
  if (result.state === 'pending') return { state: 'pending', operationId: result.providerOperationId ?? attemptId, ...(result.providerVoice ? { providerVoice: result.providerVoice } : {}) }
  if (result.state === 'verification-required') return { state: 'verification-required', ...(result.providerOperationId ? { operationId: result.providerOperationId } : {}), action: result.action ?? 'Complete provider voice verification.', ...(result.providerVoice ? { providerVoice: result.providerVoice } : {}) }
  return { state: 'external-action-required', action: result.action ?? 'Complete the provider-managed clone workflow externally.', ...(result.providerVoice ? { providerVoice: result.providerVoice } : {}) }
}

export const provisionAdvancedVoiceClone = async (input: {
  charactersRoot: string
  journalRoot: string
  provider: Pick<TtsVoiceProvider, 'provider' | 'clone'> & { accountScopeHash: string }
  providerModel: string
  subjectKey: string
  profileKey: string
  brief: CharacterVoiceBrief
  request: Omit<ProviderVoiceCloneRequest, 'localAttemptId'>
  capabilityFixtureHash: string
  now?: (() => string) | undefined
}): Promise<{ registration: VoiceRegistration, attempt?: VoiceProvisioningAttempt | undefined }> => {
  if (!input.provider.clone) throw CLIUsageError(`${input.provider.provider} does not implement voice cloning.`)
  const now = input.now ?? (() => new Date().toISOString())
  const sourceIdentityHash = hashCanonicalTtsValue({ cloneKind: input.request.cloneKind, samples: input.request.protectedSamples.map(sample => sample.sha256), desiredName: input.request.desiredName })
  const registrationId = `vr_${hashCanonicalTtsValue({ subjectKey: input.subjectKey, profileKey: input.profileKey, provider: input.provider.provider, providerModel: input.providerModel, sourceIdentityHash }).slice(0, 40)}`
  const attemptId = `vp_${hashCanonicalTtsValue({ registrationId, operation: 'clone', sourceIdentityHash }).slice(0, 40)}`
  const createdAt = now()
  let provisioning: VoiceRegistration['provisioning']
  let sanitizedProviderMetadata: Record<string, string | number | boolean | null | string[]> = { cloneKind: input.request.cloneKind, sampleCount: input.request.protectedSamples.length, attemptId, desiredName: input.request.desiredName }
  let attempt: VoiceProvisioningAttempt | undefined
  if (input.request.cloneKind === 'professional') {
    const result = await input.provider.clone.clone({ ...input.request, localAttemptId: attemptId })
    provisioning = cloneProvisioningState(result, attemptId)
    sanitizedProviderMetadata = { ...sanitizedProviderMetadata, ...result.sanitizedMetadata }
  } else {
    const evidence = input.request.protectedSamples[0]
    if (!evidence) throw CLIUsageError('Instant voice cloning requires at least one protected sample.')
    const initial: VoiceProvisioningAttempt = {
      schemaVersion: 1, attemptId, registrationDraftId: registrationId, operation: 'clone', accountScopeHash: input.provider.accountScopeHash,
      lockLeaseId: `lease_${randomUUID().replace(/-/gu, '')}`,
      requestFingerprint: planAdvancedClone({ ...input.request, localAttemptId: attemptId }).requestFingerprint,
      protectedRequestEvidence: evidence,
      ...(input.provider.provider === 'fish' ? { reconciliation: { strategy: 'provider-search' as const, providerHandle: input.request.desiredName, protectedLookupEvidence: evidence } } : {}),
      transitions: [{ sequence: 1, phase: 'prepared', at: createdAt }], issuedResources: [], compareAndSwapVersion: 0,
    }
    attempt = await runCrashSafeVoiceProvisioning({
      journalRoot: input.journalRoot,
      attempt: initial,
      mutate: async () => {
        const result = await input.provider.clone!.clone({ ...input.request, localAttemptId: attemptId })
        const state = cloneProvisioningState(result, attemptId)
        return {
          state,
          issuedResources: result.providerVoice ? [{ providerVoice: result.providerVoice, observedAt: result.checkedAt, sanitizedResponseHash: hashCanonicalTtsValue(result.sanitizedMetadata) }] : [],
          evidenceHash: hashCanonicalTtsValue(result),
        }
      },
    })
    provisioning = attempt.outcome ?? { state: 'reconciliation-required', attemptId, reason: 'Clone attempt has no terminal provider outcome.' }
  }
  const base = {
    schemaVersion: 1 as const,
    registrationId,
    subjectKey: input.subjectKey,
    profileKey: input.profileKey,
    provider: input.provider.provider,
    providerModel: input.providerModel,
    briefHash: hashCharacterVoiceBrief(input.brief),
    provenanceRef: input.request.provenanceRef,
    consentRecordRef: input.request.consentRecordRef,
    settingsSchema: `${input.provider.provider}.voice-defaults.v1`,
    synthesisSettings: { schemaVersion: 1 as const, settingsSchema: `${input.provider.provider}.voice-defaults.v1`, values: {} },
    capabilityFixtureHash: input.capabilityFixtureHash,
    sanitizedProviderMetadata,
    retention: DEFAULT_VOICE_RETENTION_POLICY,
    cleanupState: { state: 'retained' as const, checkedAt: createdAt },
    createdAt,
    updatedAt: createdAt,
    approval: { state: 'draft' as const },
    provisioning,
  }
  const registration = { ...base, generationId: hashCanonicalRecordWithout({ ...base, generationId: '0'.repeat(64) }, ['generationId']) } as VoiceRegistration
  await appendVoiceRegistration(input.charactersRoot, registration)
  return { registration, ...(attempt ? { attempt } : {}) }
}

export const computeAdvancedProviderFixtureHash = (provider: Pick<TtsVoiceProvider, 'getDeclaredCapabilities'>): string =>
  hashCanonicalRecordWithout({ schemaVersion: 1, records: provider.getDeclaredCapabilities() }, [])
