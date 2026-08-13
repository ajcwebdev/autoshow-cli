import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type {
  CharacterVoiceBrief,
  PlannedCost,
  ProviderVoiceCloneRequest,
  TtsVoiceProvider,
  VoiceCandidate,
  VoiceConsentRecord,
  VoiceProvisioningAttempt,
  VoiceRegistration,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import type { ProtectedVoiceAssetStore } from '../voice-assets/protected-voice-asset-store'
import { canonicalTtsJson, hashCanonicalRecordWithout, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { appendVoiceRegistration, hashCharacterVoiceBrief } from './character-voice-registry'
import { buildReadyVoiceRegistrationDraft } from './voice-registration-management'
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
    reconciliation: { strategy: 'provider-operation' as const, protectedLookupEvidence: input.protectedEvidence },
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
    now: now()
  })
  const design = requireDesignPort(input.provider)
  const attempt = await runCrashSafeVoiceProvisioning({
    journalRoot: input.journalRoot,
    attempt: initial,
    mutate: async () => {
      if (!candidate.providerCandidateId) throw CLIUsageError('Advanced voice candidate omits its provider candidate ID.')
      const result = await design.materializeCandidate({ providerCandidateId: candidate.providerCandidateId, desiredName: input.desiredName, localAttemptId: initial.attemptId, ...(input.sourceVoice ? { sourceVoice: input.sourceVoice } : {}), ...(input.eligibilitySnapshotHash ? { eligibilitySnapshotHash: input.eligibilitySnapshotHash } : {}) })
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
    sanitizedProviderMetadata: { candidateId: candidate.candidateId, attemptId: attempt.attemptId, briefHash: hashCharacterVoiceBrief(input.brief) }
  })
  await appendVoiceRegistration(input.charactersRoot, registration)
  return { candidate: materialized, registration, attempt }
}

export const planAdvancedClone = (request: ProviderVoiceCloneRequest): { estimatedCostCents: 0, requestFingerprint: string } => ({
  estimatedCostCents: 0,
  requestFingerprint: hashCanonicalTtsValue({ ...request, protectedSamples: request.protectedSamples.map(sample => sample.sha256) })
})

export const computeAdvancedProviderFixtureHash = (provider: Pick<TtsVoiceProvider, 'getDeclaredCapabilities'>): string =>
  hashCanonicalRecordWithout({ schemaVersion: 1, records: provider.getDeclaredCapabilities() }, [])
