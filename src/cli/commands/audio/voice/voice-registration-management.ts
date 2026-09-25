import { join } from 'node:path'
import type {
  CharacterVoiceBrief,
  CurrentVoiceRegistrationIndex,
  ProtectedAssetRef,
  ProviderVoiceRef,
  SanitizedProviderVoiceMetadata,
  TtsProvider,
  TypedProviderSynthesisSettings,
  VoiceAuditionItem,
  VoiceAuditionManifest,
  VoiceConsentRecord,
  VoiceRegistration,
  VoiceRetentionPolicy,
  VoiceRegistrationReadiness,
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import { hashCanonicalRecordWithout, hashCanonicalTtsValue } from '../tts/script-to-audio/contract-identity'
import { appendVoiceRegistration, hashCharacterVoiceBrief, loadCurrentVoiceRegistrationIndex, resolveCharacterVoiceRegistryPaths, resolveVoiceReferenceGenerationRoot, writeCreateOnlyJson } from './character-voice-registry'
import { assertVoiceConsentAllows, computeVoiceAuditionId, validateVoiceAuditionManifest, validateVoiceConsentRecord, validateVoiceRegistration } from './voice-management-contracts'
import { atomicWriteJson } from '~/utils/filesystem'

export const DEFAULT_VOICE_RETENTION_POLICY: VoiceRetentionPolicy = {
  protectedAssets: 'delete-on-revocation',
  providerResource: 'retain',
  cacheAfterRevocation: 'deny',
  exportAfterRevocation: 'deny'
}

const computeRegistrationGeneration = (registration: VoiceRegistration): VoiceRegistration => ({
  ...registration,
  generationId: hashCanonicalRecordWithout(registration as unknown as Record<string, unknown>, ['generationId'])
} as VoiceRegistration)

const defaultRegistrationId = (input: {
  subjectKey: string
  profileKey: string
  provider: TtsProvider
  providerModel: string
  sourceIdentityHash: string
}): string => `vr_${hashCanonicalTtsValue(input).slice(0, 40)}`

export const buildReadyVoiceRegistrationDraft = (input: {
  registrationId?: string | undefined
  priorGenerationId?: string | undefined
  subjectKey: string
  profileKey: string
  provider: TtsProvider
  providerModel: string
  creationModel?: string | undefined
  providerVoice: ProviderVoiceRef
  brief: CharacterVoiceBrief
  provenanceRef: string
  consent?: VoiceConsentRecord | undefined
  consentRecordRef?: string | undefined
  settings?: TypedProviderSynthesisSettings | undefined
  capabilityFixtureHash: string
  accountCapabilityObservationHash?: string | undefined
  sanitizedProviderMetadata?: SanitizedProviderVoiceMetadata | undefined
  retention?: VoiceRetentionPolicy | undefined
  createdAt?: string | undefined
  updatedAt?: string | undefined
  approval?: VoiceRegistration['approval'] | undefined
  approvedAuditionId?: string | undefined
}): VoiceRegistration => {
  if (input.providerVoice.provider !== input.provider) throw UsageError('Registration voice provider does not match its target provider.')
  if (input.consent) {
    validateVoiceConsentRecord(input.consent)
    if (input.consent.subjectKey !== input.subjectKey) throw UsageError('Consent subject does not match the voice registration subject.')
    if (!input.consentRecordRef?.startsWith('protected-consent:v1:')) throw UsageError('Consent-bound registration requires its protected consent-record locator.')
    assertVoiceConsentAllows(input.consent, 'new-synthesis')
  }
  const createdAt = input.createdAt ?? new Date().toISOString()
  const settings = input.settings ?? { schemaVersion: 1, settingsSchema: `${input.provider}.voice-defaults.v1`, values: {} }
  const registrationId = input.registrationId ?? defaultRegistrationId({
    subjectKey: input.subjectKey,
    profileKey: input.profileKey,
    provider: input.provider,
    providerModel: input.providerModel,
    sourceIdentityHash: hashCanonicalTtsValue(input.providerVoice)
  })
  const registration = computeRegistrationGeneration({
    schemaVersion: 1,
    registrationId,
    generationId: '0'.repeat(64),
    ...(input.priorGenerationId ? { priorGenerationId: input.priorGenerationId } : {}),
    subjectKey: input.subjectKey,
    profileKey: input.profileKey,
    provider: input.provider,
    providerModel: input.providerModel,
    ...(input.creationModel ? { creationModel: input.creationModel } : {}),
    briefHash: hashCharacterVoiceBrief(input.brief),
    provenanceRef: input.provenanceRef,
    ...(input.consent ? { consentRecordRef: input.consentRecordRef } : {}),
    settingsSchema: settings.settingsSchema,
    synthesisSettings: settings,
    capabilityFixtureHash: input.capabilityFixtureHash,
    ...(input.accountCapabilityObservationHash ? { accountCapabilityObservationHash: input.accountCapabilityObservationHash } : {}),
    sanitizedProviderMetadata: input.sanitizedProviderMetadata ?? {},
    retention: input.retention ?? DEFAULT_VOICE_RETENTION_POLICY,
    cleanupState: { state: 'retained', checkedAt: createdAt },
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    approval: input.approval ?? { state: 'draft' },
    ...(input.approvedAuditionId ? { approvedAuditionId: input.approvedAuditionId } : {}),
    provisioning: { state: 'ready', providerVoice: input.providerVoice }
  } as unknown as VoiceRegistration)
  return validateVoiceRegistration(registration)
}

const buildStockVoiceAuditionManifest = (
  registrationId: string,
  provider: TtsProvider,
  providerModel: string,
  providerVoice: ProviderVoiceRef,
  capabilityFixtureHash: string,
  settingsSchema: string,
  synthesisSettings: TypedProviderSynthesisSettings,
  createdAt: string
): VoiceAuditionManifest => {
  const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  const protectedAudio: ProtectedAssetRef = {
    storeId: 'store_system',
    assetId: `sha256_${sha256}`,
    sha256
  }
  const zeroCost = { amounts: [{ amount: 0, currency: 'USD' }] }
  const itemCategories = ['neutral', 'representative', 'emotional-delivery', 'pronunciation', 'comparison'] as const
  const items: VoiceAuditionItem[] = itemCategories.map((category, idx) => ({
    itemId: `item_${idx + 1}`,
    category,
    canonicalText: 'Stock audition passage.',
    providerText: 'Stock audition passage.',
    takes: [{
      takeId: `take_${idx + 1}`,
      protectedAudio,
      sha256: protectedAudio.sha256,
      cost: zeroCost,
      warnings: []
    }],
    selectedTakeId: `take_${idx + 1}`
  }))

  const withoutId = {
    schemaVersion: 1 as const,
    registrationDraftId: registrationId,
    provider,
    providerModel,
    providerVoice,
    capabilityFixtureHash,
    settingsSchema,
    synthesisSettings,
    items,
    plannedCost: zeroCost,
    warnings: [],
    createdAt
  }
  const manifest: VoiceAuditionManifest = { ...withoutId, auditionId: computeVoiceAuditionId(withoutId) }
  return validateVoiceAuditionManifest(manifest)
}

export const importExistingVoiceRegistration = async (input: {
  charactersRoot: string
  subjectKey: string
  profileKey: string
  provider: TtsProvider
  providerModel: string
  resourceId: string
  origin: 'provider-stock' | 'designed' | 'remixed' | 'instant-clone' | 'professional-clone' | 'imported-custom' | 'saved-reference'
  expiresAt?: string | undefined
  sanitizedProviderMetadata?: SanitizedProviderVoiceMetadata | undefined
  ownership?: 'provider' | 'third-party' | 'account' | 'project' | undefined
  accountScopeHash?: string | undefined
  brief: CharacterVoiceBrief
  provenanceRef: string
  consent?: VoiceConsentRecord | undefined
  consentRecordRef?: string | undefined
  capabilityFixtureHash: string
  settings?: TypedProviderSynthesisSettings | undefined
}): Promise<VoiceRegistration> => {
  if (!input.resourceId.trim()) throw UsageError('Voice import requires an existing provider resource ID.')
  const namespace = input.origin === 'provider-stock' ? 'provider' as const : 'account' as const
  if (namespace === 'account' && !input.accountScopeHash) throw UsageError('Account voice import requires a non-secret account scope hash.')
  const now = new Date().toISOString()
  const providerVoice: ProviderVoiceRef = {
    kind: 'remote-resource',
    provider: input.provider,
    resourceId: input.resourceId.trim(),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    namespace,
    ...(input.accountScopeHash ? { accountScopeHash: input.accountScopeHash } : {}),
    origin: input.origin,
    ownership: input.ownership ?? (input.origin === 'provider-stock' ? 'provider' : 'account'),
    deletion: input.ownership === 'project'
      ? { state: 'eligible', checkedAt: now }
      : { state: input.origin === 'provider-stock' ? 'provider-managed' : 'external-only', checkedAt: now }
  }

  if (input.origin === 'provider-stock') {
    const settingsSchema = `${input.provider}.voice-defaults.v1`
    const synthesisSettings = input.settings ?? { schemaVersion: 1, settingsSchema, values: {} }
    const registrationId = defaultRegistrationId({
      subjectKey: input.subjectKey,
      profileKey: input.profileKey,
      provider: input.provider,
      providerModel: input.providerModel,
      sourceIdentityHash: hashCanonicalTtsValue(providerVoice)
    })
    const audition = buildStockVoiceAuditionManifest(
      registrationId,
      input.provider,
      input.providerModel,
      providerVoice,
      input.capabilityFixtureHash,
      settingsSchema,
      synthesisSettings,
      now
    )
    const registration = buildReadyVoiceRegistrationDraft({
      ...input,
      registrationId,
      providerVoice,
      approval: { state: 'approved', auditionId: audition.auditionId, approvedAt: now, approvedBy: { actorId: 'system', namespace: 'automation' } },
      approvedAuditionId: audition.auditionId,
      createdAt: now,
      updatedAt: now
    })
    await appendVoiceRegistration(input.charactersRoot, registration)

    const paths = resolveCharacterVoiceRegistryPaths(input.charactersRoot)
    const refDir = resolveVoiceReferenceGenerationRoot(input.charactersRoot, registration)
    await writeCreateOnlyJson(join(refDir, 'audition-manifest.json'), audition)
    await writeCreateOnlyJson(join(refDir, 'registration-snapshot.json'), registration)

    const current = await loadCurrentVoiceRegistrationIndex(input.charactersRoot)
    const selectionKey = `${registration.subjectKey}\0${registration.provider}\0${registration.providerModel}\0${registration.profileKey}`
    const nextSelection = {
      subjectKey: registration.subjectKey,
      provider: registration.provider,
      providerModel: registration.providerModel,
      profileKey: registration.profileKey,
      registrationId: registration.registrationId,
      generationId: registration.generationId,
      updatedAt: now
    }
    const nextIndex: CurrentVoiceRegistrationIndex = {
      schemaVersion: 2,
      revision: current.revision + 1,
      selections: [...current.selections.filter(selection => `${selection.subjectKey}\0${selection.provider}\0${selection.providerModel}\0${selection.profileKey}` !== selectionKey), nextSelection]
    }
    await atomicWriteJson(paths.current, nextIndex)
    return registration
  }

  const registration = buildReadyVoiceRegistrationDraft({ ...input, providerVoice })
  await appendVoiceRegistration(input.charactersRoot, registration)
  return registration
}

export const inspectVoiceRegistrationReadiness = async (input: {
  registration: VoiceRegistration
  staticOnly?: boolean | undefined
}): Promise<VoiceRegistrationReadiness> => {
  const registration = validateVoiceRegistration(input.registration)
  const checkedAt = new Date().toISOString()
  if (registration.approval.state === 'revoked' || registration.approval.state === 'retired' || registration.provisioning.state !== 'ready') {
    const reason = `Registration is ${registration.approval.state}/${registration.provisioning.state}.`
    return { state: 'blocked', registrationId: registration.registrationId, generationId: registration.generationId, checkedAt, networkAccess: 'none', evidenceHash: hashCanonicalTtsValue({ registrationId: registration.registrationId, generationId: registration.generationId, result: 'blocked', reason }), reason }
  }
  const voice = registration.provisioning.providerVoice
  if (voice.kind !== 'remote-resource' || voice.namespace === 'provider') {
    return { state: 'ready', registrationId: registration.registrationId, generationId: registration.generationId, checkedAt, networkAccess: 'none', evidenceHash: hashCanonicalTtsValue({ registrationId: registration.registrationId, generationId: registration.generationId, result: 'local-ready' }) }
  }
  if (input.staticOnly) {
    const reason = 'Static validation cannot prove current account-resource readiness without a read-only provider inspection.'
    return { state: 'external-action-required', registrationId: registration.registrationId, generationId: registration.generationId, checkedAt, networkAccess: 'none', evidenceHash: hashCanonicalTtsValue({ registrationId: registration.registrationId, generationId: registration.generationId, result: 'static-only' }), reason }
  }
  const reason = `Read-only readiness inspection is not implemented for account-namespaced ${registration.provider} voices in Phase 1.`
  return { state: 'external-action-required', registrationId: registration.registrationId, generationId: registration.generationId, checkedAt, networkAccess: 'none', evidenceHash: hashCanonicalTtsValue({ registrationId: registration.registrationId, generationId: registration.generationId, result: 'adapter-unavailable' }), reason }
}
