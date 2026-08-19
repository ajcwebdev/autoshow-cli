import { randomUUID } from 'node:crypto'
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
  MistralSavedReferencePlan,
  MistralVoiceManagementRequest,
  ProtectedVoiceAssetStore,
  VoiceRegistrationReadiness,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { assertProtectedStoreOutputDisjoint } from '../voice-assets/protected-output-boundary'
import { hashCanonicalRecordWithout, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { appendVoiceRegistration, atomicWriteJson, hashCharacterVoiceBrief, loadCurrentVoiceRegistrationIndex, loadVoiceRegistrationCatalog, recordVoiceProvisioningOutcome, resolveCharacterVoiceRegistryPaths, writeCreateOnlyJson } from './character-voice-registry'
import { assertVoiceConsentAllows, computeVoiceAuditionId, validateVoiceAuditionManifest, validateVoiceConsentRecord, validateVoiceRegistration } from './voice-management-contracts'
import { createMistralSavedVoice, findMistralSavedVoiceBySlug, inspectMistralSavedVoice, mistralAccountScopeHash } from './mistral-voice-management'
import { loadVoiceProvisioningAttempt, reconcileVoiceProvisioningAttempt, requireVoiceProvisioningReconciliation, runCrashSafeVoiceProvisioning } from './provisioning-journal'

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
  if (input.providerVoice.provider !== input.provider) throw CLIUsageError('Registration voice provider does not match its target provider.')
  if (input.consent) {
    validateVoiceConsentRecord(input.consent)
    if (input.consent.subjectKey !== input.subjectKey) throw CLIUsageError('Consent subject does not match the voice registration subject.')
    if (!input.consentRecordRef?.startsWith('protected-consent:v1:')) throw CLIUsageError('Consent-bound registration requires its protected consent-record locator.')
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
  ownership?: 'provider' | 'third-party' | 'account' | 'project' | undefined
  accountScopeHash?: string | undefined
  brief: CharacterVoiceBrief
  provenanceRef: string
  consent?: VoiceConsentRecord | undefined
  consentRecordRef?: string | undefined
  capabilityFixtureHash: string
  settings?: TypedProviderSynthesisSettings | undefined
}): Promise<VoiceRegistration> => {
  if (!input.resourceId.trim()) throw CLIUsageError('Voice import requires an existing provider resource ID.')
  const namespace = input.origin === 'provider-stock' ? 'provider' as const : 'account' as const
  if (namespace === 'account' && !input.accountScopeHash) throw CLIUsageError('Account voice import requires a non-secret account scope hash.')
  const now = new Date().toISOString()
  const providerVoice: ProviderVoiceRef = {
    kind: 'remote-resource',
    provider: input.provider,
    resourceId: input.resourceId.trim(),
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
    const refDir = join(
      paths.referencesRoot,
      registration.subjectKey,
      registration.provider,
      registration.registrationId,
      registration.generationId
    )
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

export const planMistralSavedReferenceRegistration = async (input: {
  protectedStore: ProtectedVoiceAssetStore
  subjectKey: string
  profileKey: string
  providerModel: string
  sourcePath: string
  authorizationRef: string
}): Promise<MistralSavedReferencePlan> => {
  const planned = await input.protectedStore.plan({ sourcePath: input.sourcePath, authorizationRef: input.authorizationRef })
  const registrationId = defaultRegistrationId({
    subjectKey: input.subjectKey,
    profileKey: input.profileKey,
    provider: 'mistral',
    providerModel: input.providerModel,
    sourceIdentityHash: planned.protectedAsset.sha256
  })
  const attemptId = `vp_${hashCanonicalTtsValue({ registrationId, operation: 'save-reference' }).slice(0, 40)}`
  return { registrationId, attemptId, slug: `autoshow-${attemptId.replace(/_/g, '-')}`, source: planned.protectedAsset, estimatedCostCents: 0 }
}

export const provisionMistralSavedReferenceRegistration = async (input: {
  charactersRoot: string
  journalRoot?: string | undefined
  protectedStore: ProtectedVoiceAssetStore
  subjectKey: string
  profileKey: string
  providerModel: string
  voiceName: string
  sourcePath: string
  authorizationRef: string
  brief: CharacterVoiceBrief
  provenanceRef: string
  consent: VoiceConsentRecord
  consentRecordRef?: string | undefined
  capabilityFixtureHash: string
  apiKey: string
  languages?: string[] | undefined
  baseURL?: string | undefined
  request?: MistralVoiceManagementRequest | undefined
  faultInjection?: Parameters<typeof runCrashSafeVoiceProvisioning>[0]['faultInjection'] | undefined
}): Promise<VoiceRegistration> => {
  validateVoiceConsentRecord(input.consent)
  if (input.consent.subjectKey !== input.subjectKey) throw CLIUsageError('Mistral reference consent subject does not match the registration subject.')
  if (!input.consentRecordRef?.startsWith('protected-consent:v1:')) throw CLIUsageError('Mistral saved reference requires the protected consent-record locator used by later audition and synthesis gates.')
  assertVoiceConsentAllows(input.consent, 'upload')
  assertVoiceConsentAllows(input.consent, 'new-synthesis')
  if (!input.protectedStore.root || !input.protectedStore.ingestManaged || !input.protectedStore.storeBytes) throw CLIUsageError('Mistral saved reference requires a managed registered protected store.')
  await assertProtectedStoreOutputDisjoint(input.charactersRoot, input.protectedStore.root)
  const plan = await planMistralSavedReferenceRegistration(input)
  const briefHash = hashCharacterVoiceBrief(input.brief)
  const existingCatalog = await loadVoiceRegistrationCatalog(input.charactersRoot)
  const existingChain = existingCatalog.registrations.filter(registration => registration.registrationId === plan.registrationId)
  const existingLeaf = existingChain.find(registration => !existingChain.some(candidate => candidate.priorGenerationId === registration.generationId))
  const identityMatches = (registration: VoiceRegistration | undefined): registration is VoiceRegistration => registration !== undefined
    && registration.subjectKey === input.subjectKey
    && registration.profileKey === input.profileKey
    && registration.provider === 'mistral'
    && registration.providerModel === input.providerModel
    && registration.briefHash === briefHash
    && registration.provenanceRef === input.provenanceRef
    && registration.consentRecordRef === input.consentRecordRef
    && registration.capabilityFixtureHash === input.capabilityFixtureHash
  if (existingLeaf?.provisioning.state === 'ready') {
    if (!identityMatches(existingLeaf) || existingLeaf.sanitizedProviderMetadata['sourceAssetSha256'] !== plan.source.sha256) throw CLIUsageError('Existing Mistral saved-reference registration identity does not match the requested source and policy.')
    return existingLeaf
  }
  if (existingLeaf && (!identityMatches(existingLeaf) || existingLeaf.provisioning.state !== 'pending' || existingLeaf.provisioning.operationId !== plan.attemptId)) {
    throw CLIUsageError('Existing Mistral saved-reference registration identity has incompatible state; inspect or reconcile it instead of creating again.')
  }
  const createdAt = new Date().toISOString()
  const materialized = await input.protectedStore.ingestManaged({ sourcePath: input.sourcePath, authorizationRef: input.authorizationRef }, {
    schemaVersion: 1,
    purpose: 'reference-audio',
    authorizationRef: input.authorizationRef,
    retention: { mode: 'retain-until-revoked', obligationRef: input.provenanceRef },
    consentRecordRef: input.consentRecordRef,
    createdAt
  }, plan.source)
  const lookupEvidence = await input.protectedStore.storeBytes(Buffer.from(JSON.stringify({ schemaVersion: 1, provider: 'mistral', slug: plan.slug }), 'utf8'), {
    schemaVersion: 1,
    purpose: 'reconciliation-evidence',
    authorizationRef: `voice-provisioning:${plan.attemptId}`,
    retention: { mode: 'retain-until-revoked', obligationRef: input.provenanceRef },
    consentRecordRef: input.consentRecordRef,
    createdAt
  })
  const accountScopeHash = mistralAccountScopeHash(input.apiKey)
  let pending = existingLeaf ?? computeRegistrationGeneration({
    schemaVersion: 1,
    registrationId: plan.registrationId,
    generationId: '0'.repeat(64),
    subjectKey: input.subjectKey,
    profileKey: input.profileKey,
    provider: 'mistral',
    providerModel: input.providerModel,
    briefHash,
    provenanceRef: input.provenanceRef,
    consentRecordRef: input.consentRecordRef,
    settingsSchema: 'mistral.voice-defaults.v1',
    synthesisSettings: { schemaVersion: 1, settingsSchema: 'mistral.voice-defaults.v1', values: {} },
    capabilityFixtureHash: input.capabilityFixtureHash,
    sanitizedProviderMetadata: { provisioningAttemptId: plan.attemptId },
    retention: DEFAULT_VOICE_RETENTION_POLICY,
    cleanupState: { state: 'retained', checkedAt: createdAt },
    createdAt,
    updatedAt: createdAt,
    approval: { state: 'draft' },
    provisioning: { state: 'pending', operationId: plan.attemptId }
  })
  if (!existingLeaf) {
    try {
      await appendVoiceRegistration(input.charactersRoot, pending)
    } catch (error) {
      const concurrentCatalog = await loadVoiceRegistrationCatalog(input.charactersRoot)
      const concurrentChain = concurrentCatalog.registrations.filter(registration => registration.registrationId === plan.registrationId)
      const concurrentLeaf = concurrentChain.find(registration => !concurrentChain.some(candidate => candidate.priorGenerationId === registration.generationId))
      if (identityMatches(concurrentLeaf) && concurrentLeaf.provisioning.state === 'ready' && concurrentLeaf.sanitizedProviderMetadata['sourceAssetSha256'] === plan.source.sha256) return concurrentLeaf
      if (!identityMatches(concurrentLeaf) || concurrentLeaf.provisioning.state !== 'pending' || concurrentLeaf.provisioning.operationId !== plan.attemptId) throw error
      pending = concurrentLeaf
    }
  }
  const journalRoot = input.journalRoot ?? `${input.charactersRoot}/voice-provisioning`
  const attempt = await runCrashSafeVoiceProvisioning({
    journalRoot,
    attempt: {
      schemaVersion: 1,
      attemptId: plan.attemptId,
      registrationDraftId: plan.registrationId,
      operation: 'save-reference',
      accountScopeHash,
      lockLeaseId: `lease_${randomUUID().replace(/-/g, '')}`,
      requestFingerprint: hashCanonicalTtsValue({ provider: 'mistral', operation: 'save-reference', name: input.voiceName, slug: plan.slug, sourceSha256: plan.source.sha256, languages: input.languages ?? [] }),
      protectedRequestEvidence: materialized.protectedAsset,
      reconciliation: { strategy: 'provider-search', providerHandle: plan.slug, protectedLookupEvidence: lookupEvidence },
      transitions: [{ sequence: 1, phase: 'prepared', at: pending.createdAt }],
      issuedResources: [],
      compareAndSwapVersion: 0
    },
    mutate: async () => {
      const sourcePath = await input.protectedStore.resolve(materialized.protectedAsset)
      const created = await createMistralSavedVoice({
        apiKey: input.apiKey,
        protectedSamplePath: sourcePath,
        name: input.voiceName,
        slug: plan.slug,
        languages: input.languages,
        baseURL: input.baseURL,
        request: input.request
      })
      return {
        state: { state: 'ready', providerVoice: created.providerVoice },
        issuedResources: [{ providerVoice: created.providerVoice, observedAt: created.observedAt, sanitizedResponseHash: created.sanitizedResponseHash }],
        evidenceHash: created.sanitizedResponseHash
      }
    },
    faultInjection: input.faultInjection
  })
  if (attempt.outcome?.state !== 'ready') throw CLIUsageError('Mistral saved reference did not reach ready state.')
  const outcomeVoice = attempt.outcome.providerVoice
  if (outcomeVoice.kind !== 'remote-resource') throw CLIUsageError('Ready Mistral saved reference is not a remote resource.')
  if (!attempt.issuedResources.some(entry => entry.providerVoice.kind === 'remote-resource' && entry.providerVoice.resourceId === outcomeVoice.resourceId)) throw CLIUsageError('Ready Mistral resource is missing from the provisioning journal.')
  return await recordVoiceProvisioningOutcome({
    charactersRoot: input.charactersRoot,
    registrationId: plan.registrationId,
    generationId: pending.generationId,
    provisioning: attempt.outcome,
    sanitizedProviderMetadata: { provisioningAttemptId: plan.attemptId, sourceAssetSha256: materialized.protectedAsset.sha256 }
  })
}

export const reconcileMistralSavedReferenceRegistration = async (input: {
  charactersRoot: string
  registration: VoiceRegistration
  apiKey: string
  baseURL?: string | undefined
  request?: MistralVoiceManagementRequest | undefined
}): Promise<VoiceRegistration> => {
  const registration = input.registration
  if (registration.provider !== 'mistral') throw CLIUsageError('Only Mistral saved-reference reconciliation is implemented in Phase 1.')
  const attemptId = typeof registration.sanitizedProviderMetadata['provisioningAttemptId'] === 'string'
    ? registration.sanitizedProviderMetadata['provisioningAttemptId']
    : registration.provisioning.state === 'pending'
      ? registration.provisioning.operationId
      : undefined
  if (!attemptId) throw CLIUsageError('Mistral registration does not identify its provisioning attempt.')
  const journalRoot = `${input.charactersRoot}/voice-provisioning`
  let attempt = await loadVoiceProvisioningAttempt(journalRoot, registration.registrationId, attemptId)
  if (mistralAccountScopeHash(input.apiKey) !== attempt.accountScopeHash) throw CLIUsageError('Mistral reconciliation credentials do not match the provisioning account scope.')
  if (attempt.outcome === undefined) attempt = await requireVoiceProvisioningReconciliation(journalRoot, registration.registrationId, attemptId)
  if (attempt.outcome?.state === 'reconciliation-required') {
    let issued = attempt.issuedResources.find(resource => resource.providerVoice.provider === 'mistral')
    if (!issued) {
      const slug = attempt.reconciliation?.strategy === 'provider-search' ? attempt.reconciliation.providerHandle : undefined
      if (!slug) throw CLIUsageError('Mistral provisioning journal has no safe reconciliation lookup handle.')
      const observed = await findMistralSavedVoiceBySlug({ apiKey: input.apiKey, slug, baseURL: input.baseURL, request: input.request })
      if (observed) issued = { providerVoice: observed.providerVoice, observedAt: observed.observedAt, sanitizedResponseHash: observed.sanitizedResponseHash }
    }
    if (issued) {
      attempt = await reconcileVoiceProvisioningAttempt({
        journalRoot,
        registrationDraftId: registration.registrationId,
        attemptId,
        outcome: { state: 'ready', providerVoice: issued.providerVoice },
        issuedResources: [issued],
        evidenceHash: issued.sanitizedResponseHash
      })
    } else {
      const evidenceHash = hashCanonicalTtsValue({ provider: 'mistral', attemptId, result: 'not-found' })
      attempt = await reconcileVoiceProvisioningAttempt({
        journalRoot,
        registrationDraftId: registration.registrationId,
        attemptId,
        outcome: { state: 'failed', code: 'reconciliation-not-found', message: 'No Mistral saved voice matched the durable provisioning handle.' },
        evidenceHash
      })
    }
  }
  if (!attempt.outcome) throw CLIUsageError('Mistral reconciliation did not produce a durable outcome.')
  return await recordVoiceProvisioningOutcome({
    charactersRoot: input.charactersRoot,
    registrationId: registration.registrationId,
    generationId: registration.generationId,
    provisioning: attempt.outcome,
    sanitizedProviderMetadata: { provisioningAttemptId: attemptId, reconciliationState: attempt.outcome.state, sourceAssetSha256: attempt.protectedRequestEvidence.sha256 }
  })
}

export const inspectVoiceRegistrationReadiness = async (input: {
  registration: VoiceRegistration
  apiKey?: string | undefined
  baseURL?: string | undefined
  request?: MistralVoiceManagementRequest | undefined
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
  if (registration.provider !== 'mistral') {
    const reason = `Read-only readiness inspection is not implemented for account-namespaced ${registration.provider} voices in Phase 1.`
    return { state: 'external-action-required', registrationId: registration.registrationId, generationId: registration.generationId, checkedAt, networkAccess: 'none', evidenceHash: hashCanonicalTtsValue({ registrationId: registration.registrationId, generationId: registration.generationId, result: 'adapter-unavailable' }), reason }
  }
  if (!input.apiKey) throw CLIUsageError('Mistral account-resource readiness requires an API key.')
  const observed = await inspectMistralSavedVoice({ apiKey: input.apiKey, voiceId: voice.resourceId, baseURL: input.baseURL, request: input.request })
  if (observed.accountScopeHash !== voice.accountScopeHash) throw CLIUsageError('Mistral readiness credentials do not match the registered account scope.')
  return { state: 'ready', registrationId: registration.registrationId, generationId: registration.generationId, checkedAt: observed.observedAt, networkAccess: 'read-only', evidenceHash: observed.sanitizedResponseHash }
}
