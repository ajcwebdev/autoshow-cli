import type { CliCommandContext, CliCommandDefinition, TtsProvider, TtsVoiceProvider, VoiceConsentAction, VoiceConsentRecord } from '~/types'
import { join } from 'node:path'
import { defineCliCommand } from '~/cli/native/native-types'
import { boolFlag, strFlag } from '~/cli/flags/flag-utils'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { CLIUsageError } from '~/utils/error-handler'
import { requireApiKey } from '~/utils/validate/env-utils'
import { withProcessLock } from '~/utils/process-lock'
import { hashCanonicalRecordWithout, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { assertProtectedStoreOutputDisjoint } from '../voice-assets/protected-output-boundary'
import { managedVoiceAssetStore, MANAGED_VOICE_STORE_ROOT } from './managed-voice-store'
import { loadVoiceConsentRecord, revokeVoiceConsentRecord, storeVoiceConsentRecord } from './voice-consent-store'
import { importExistingVoiceRegistration, inspectVoiceRegistrationReadiness, planMistralSavedReferenceRegistration, provisionMistralSavedReferenceRegistration, reconcileMistralSavedReferenceRegistration } from './voice-registration-management'
import { deleteMistralSavedVoice, inspectMistralSavedVoiceIfPresent, mistralAccountScopeHash } from './mistral-voice-management'
import { planCanonicalVoiceAudition, runCanonicalVoiceAudition } from './canonical-voice-audition'
import {
  approveVoiceRegistration,
  beginVoiceRegistrationDeletion,
  loadCharacterVoiceBriefCatalog,
  loadCurrentVoiceRegistrationIndex,
  loadVoiceAuditionManifestForRegistration,
  loadVoiceRegistrationCatalog,
  recordVoiceAudition,
  transitionVoiceRegistrationLifecycle,
} from './character-voice-registry'
import { assertVoiceConsentAllows, computeConsentRecordId, validateAuditActorRef, validateVoiceConsentRecord } from './voice-management-contracts'
import { createElevenLabsAdvancedProvider, ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/tts-elevenlabs/elevenlabs-advanced-provider'
import { createHumeAdvancedProvider, HUME_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/hume/hume-advanced-provider'
import { createMiniMaxAdvancedProvider, MINIMAX_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/tts-minimax/minimax-advanced-provider'
import { createCartesiaAdvancedProvider, CARTESIA_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/cartesia/cartesia-advanced-provider'
import { createSpeechifyAdvancedProvider, SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/speechify/speechify-advanced-provider'
import { createAdvancedVoiceCandidates, loadVoiceCandidate, materializeAdvancedVoiceCandidate } from './advanced-voice-management'

const TTS_PROVIDERS = ['kitten', 'elevenlabs', 'minimax', 'groq', 'grok', 'mistral', 'openai', 'gemini', 'deepgram', 'speechify', 'hume', 'cartesia'] as const
const CONSENT_ACTIONS: VoiceConsentAction[] = ['upload', 'new-synthesis', 'cache-reuse', 'resume', 'export', 'retention', 'deletion']
const VOICE_ORIGINS = ['provider-stock', 'designed', 'remixed', 'instant-clone', 'professional-clone', 'imported-custom', 'saved-reference'] as const
const PROFILE_DEFAULT = 'default'

const ADVANCED_PROVIDERS = ['elevenlabs', 'hume', 'minimax', 'cartesia', 'speechify'] as const
const DESIGN_PROVIDERS = ['elevenlabs', 'hume', 'minimax'] as const
type AdvancedProviderName = typeof ADVANCED_PROVIDERS[number]
type DesignProviderName = typeof DESIGN_PROVIDERS[number]
type ManagedAdvancedProvider = Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string }

const isAdvancedProvider = (provider: TtsProvider): provider is AdvancedProviderName => ADVANCED_PROVIDERS.includes(provider as AdvancedProviderName)
const isDesignProvider = (provider: TtsProvider): provider is DesignProviderName => DESIGN_PROVIDERS.includes(provider as DesignProviderName)

const advancedCapabilityFixtureHash = (provider: AdvancedProviderName): string => {
  if (provider === 'elevenlabs') return ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'hume') return HUME_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'minimax') return MINIMAX_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'cartesia') return CARTESIA_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  return SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
}

const advancedProvider = (provider: AdvancedProviderName): ManagedAdvancedProvider => {
  if (provider === 'elevenlabs') return createElevenLabsAdvancedProvider({ apiKey: requireApiKey('ELEVENLABS_API_KEY', 'voice:elevenlabs', 'ElevenLabs voice management') })
  if (provider === 'hume') return createHumeAdvancedProvider({ apiKey: requireApiKey('HUME_API_KEY', 'voice:hume', 'Hume voice management') })
  if (provider === 'minimax') return createMiniMaxAdvancedProvider({ apiKey: requireApiKey('MINIMAX_API_KEY', 'voice:minimax', 'MiniMax voice management') })
  if (provider === 'cartesia') return createCartesiaAdvancedProvider({ apiKey: requireApiKey('CARTESIA_API_KEY', 'voice:cartesia', 'Cartesia voice management') })
  return createSpeechifyAdvancedProvider({ apiKey: requireApiKey('SPEECHIFY_API_KEY', 'voice:speechify', 'Speechify voice management') })
}

const commonRegistrationFlags = {
  provider: strFlag(`Voice provider: ${TTS_PROVIDERS.join('|')}`),
  model: strFlag('Provider TTS model used by this registration'),
  profile: strFlag('Casting profile key', PROFILE_DEFAULT),
  'provenance-ref': strFlag('Opaque non-secret provenance record reference'),
  'consent-ref': strFlag('Protected consent-record reference when consent is required'),
  'capability-fixture-hash': strFlag('Optional pinned local capability fixture SHA-256'),
  price: boolFlag('Validate and estimate without provider calls or artifact writes')
} as const

const requiredFlag = (ctx: CliCommandContext, name: string): string => {
  const value = ctx.flags[name]
  if (typeof value !== 'string' || !value.trim()) throw CLIUsageError(`--${name} is required.`)
  return value.trim()
}

const optionalFlag = (ctx: CliCommandContext, name: string): string | undefined => {
  const value = ctx.flags[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const parameter = (ctx: CliCommandContext, name: string): string => {
  const value = ctx.parameters[name]
  if (typeof value !== 'string' || !value.trim()) throw CLIUsageError(`${name} is required.`)
  return value.trim()
}

const providerFlag = (ctx: CliCommandContext): TtsProvider => {
  const provider = requiredFlag(ctx, 'provider')
  if (!TTS_PROVIDERS.includes(provider as TtsProvider)) throw CLIUsageError(`Unknown TTS voice provider ${provider}. Expected: ${TTS_PROVIDERS.join(', ')}.`)
  return provider as TtsProvider
}

const positiveIntegerFlag = (ctx: CliCommandContext, name: string, fallback: number): number => {
  const raw = optionalFlag(ctx, name)
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) throw CLIUsageError(`--${name} must be a positive integer.`)
  return value
}

const nonNegativeNumberFlag = (ctx: CliCommandContext, name: string): number | undefined => {
  const raw = optionalFlag(ctx, name)
  if (!raw) return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw CLIUsageError(`--${name} must be a non-negative number.`)
  return value
}

const capabilityFixtureHash = (ctx: CliCommandContext, provider: TtsProvider, model: string): string => {
  const explicit = optionalFlag(ctx, 'capability-fixture-hash')
  if (explicit && !/^[a-f0-9]{64}$/.test(explicit)) throw CLIUsageError('--capability-fixture-hash must be a lowercase SHA-256 digest.')
  return explicit ?? hashCanonicalTtsValue({ schemaVersion: 1, phase: 'adr-020-phase-1', provider, model, checkedAt: '2026-08-11' })
}

const requireBrief = async (subjectKey: string, profileKey: string) => {
  const catalog = await loadCharacterVoiceBriefCatalog(getCharactersRoot())
  const brief = catalog.briefs.find(entry => entry.subjectKey === subjectKey && entry.profileKey === profileKey)
  if (!brief) throw CLIUsageError(`No character voice brief exists for ${subjectKey}/${profileKey} in character-voices.json.`)
  return brief
}

const optionalConsent = async (reference: string | undefined): Promise<VoiceConsentRecord | undefined> =>
  reference ? await loadVoiceConsentRecord(managedVoiceAssetStore, reference) : undefined

const handleConsent = async (ctx: CliCommandContext): Promise<void> => {
  const subjectKey = parameter(ctx, 'subjectKey')
  const provenanceRef = requiredFlag(ctx, 'provenance-ref')
  const allowed = (optionalFlag(ctx, 'allow') ?? '').split(',').map(value => value.trim()).filter(Boolean)
  const unknown = allowed.filter(value => !CONSENT_ACTIONS.includes(value as VoiceConsentAction))
  if (unknown.length > 0) throw CLIUsageError(`Unknown consent action(s): ${unknown.join(', ')}. Expected: ${CONSENT_ACTIONS.join(', ')}.`)
  if (allowed.length === 0) throw CLIUsageError('--allow must grant at least one explicit consent action; omitted actions remain denied.')
  const actor = validateAuditActorRef({
    namespace: (optionalFlag(ctx, 'actor-namespace') ?? 'local-user') as 'local-user' | 'project-role' | 'automation',
    actorId: requiredFlag(ctx, 'actor-id')
  })
  const recordedAt = new Date().toISOString()
  let evidence
  const evidencePath = optionalFlag(ctx, 'evidence')
  if (evidencePath) {
    const planned = await managedVoiceAssetStore.plan({ sourcePath: evidencePath, authorizationRef: `voice-consent-evidence:${subjectKey}` })
    evidence = planned.protectedAsset
    if (ctx.flags['price'] !== true) {
      if (!managedVoiceAssetStore.ingestManaged) throw CLIUsageError('Managed protected store does not support consent evidence.')
      await assertProtectedStoreOutputDisjoint(getCharactersRoot(), MANAGED_VOICE_STORE_ROOT)
      evidence = (await managedVoiceAssetStore.ingestManaged({ sourcePath: evidencePath, authorizationRef: `voice-consent-evidence:${subjectKey}` }, {
        schemaVersion: 1,
        purpose: 'consent-evidence',
        authorizationRef: `voice-consent-evidence:${subjectKey}`,
        retention: { mode: 'retain-until-revoked', obligationRef: provenanceRef },
        createdAt: recordedAt
      }, planned.protectedAsset)).protectedAsset
    }
  }
  const withoutId = {
    schemaVersion: 1 as const,
    subjectKey,
    provenanceRef,
    status: 'active' as const,
    grants: CONSENT_ACTIONS.map(action => ({ action, allowed: allowed.includes(action) })),
    ...(evidence ? { evidence } : {}),
    recordedAt,
    recordedBy: actor
  }
  const record: VoiceConsentRecord = { ...withoutId, consentRecordId: computeConsentRecordId(withoutId) }
  validateVoiceConsentRecord(record)
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'voice-consent', estimatedCostCents: 0, mutation: false, consentRecordId: record.consentRecordId }, null, 2))
    return
  }
  const reference = await storeVoiceConsentRecord(managedVoiceAssetStore, record)
  console.log(JSON.stringify({ consentRecordId: record.consentRecordId, consentRecordRef: reference }, null, 2))
}

const handleImport = async (ctx: CliCommandContext): Promise<void> => {
  const subjectKey = parameter(ctx, 'subjectKey')
  const provider = providerFlag(ctx)
  const model = requiredFlag(ctx, 'model')
  const profileKey = optionalFlag(ctx, 'profile') ?? PROFILE_DEFAULT
  const originRaw = optionalFlag(ctx, 'origin') ?? 'provider-stock'
  if (!VOICE_ORIGINS.includes(originRaw as typeof VOICE_ORIGINS[number])) throw CLIUsageError(`--origin must be ${VOICE_ORIGINS.join('|')}.`)
  const origin = originRaw as typeof VOICE_ORIGINS[number]
  const consentRef = optionalFlag(ctx, 'consent-ref')
  const consent = await optionalConsent(consentRef)
  const brief = await requireBrief(subjectKey, profileKey)
  const accountScopeHash = optionalFlag(ctx, 'account-scope-hash')
  if (accountScopeHash && !/^[a-f0-9]{64}$/.test(accountScopeHash)) throw CLIUsageError('--account-scope-hash must be a lowercase SHA-256 digest.')
  const request = {
    charactersRoot: getCharactersRoot(), subjectKey, profileKey, provider, providerModel: model,
    resourceId: requiredFlag(ctx, 'voice-id'), origin, brief, provenanceRef: requiredFlag(ctx, 'provenance-ref'),
    ...(consent ? { consent, consentRecordRef: consentRef } : {}),
    ...(accountScopeHash ? { accountScopeHash } : {}),
    capabilityFixtureHash: capabilityFixtureHash(ctx, provider, model)
  }
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'voice-import', estimatedCostCents: 0, mutation: false, subjectKey, provider, model }, null, 2))
    return
  }
  const registration = await importExistingVoiceRegistration(request)
  console.log(JSON.stringify({ registrationId: registration.registrationId, generationId: registration.generationId, state: registration.provisioning.state }, null, 2))
}

const handleDiscover = async (ctx: CliCommandContext): Promise<void> => {
  const provider = providerFlag(ctx)
  if (!isAdvancedProvider(provider)) throw CLIUsageError(`Voice discovery currently supports ${ADVANCED_PROVIDERS.join(', ')}.`)
  const sourceRaw = optionalFlag(ctx, 'source') ?? 'account'
  if (sourceRaw !== 'account' && sourceRaw !== 'provider-library' && sourceRaw !== 'shared-library') throw CLIUsageError('--source must be account, provider-library, or shared-library.')
  if (sourceRaw === 'shared-library' && provider !== 'elevenlabs') throw CLIUsageError(`${provider} does not expose an ElevenLabs-style shared-owner voice-library namespace.`)
  const cursor = optionalFlag(ctx, 'cursor')
  if (cursor && (provider === 'hume' || provider === 'minimax')) throw CLIUsageError(`${provider} voice discovery is not paginated and does not accept --cursor.`)
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'voice-discover', provider, mutation: false, providerCalls: 0, capabilityFixtureHash: advancedCapabilityFixtureHash(provider) }, null, 2))
    return
  }
  const adapter = advancedProvider(provider)
  const page = await adapter.catalog?.list({ source: sourceRaw, ...(cursor ? { cursor } : {}) })
  console.log(JSON.stringify(page, null, 2))
}

const handleDesign = async (ctx: CliCommandContext): Promise<void> => {
  const subjectKey = parameter(ctx, 'subjectKey')
  const provider = providerFlag(ctx)
  if (!isDesignProvider(provider)) throw CLIUsageError(`Voice Design currently supports ${DESIGN_PROVIDERS.join(', ')}; Cartesia and Speechify do not expose text-prompt design APIs.`)
  const providerModel = requiredFlag(ctx, 'model')
  const creationModel = requiredFlag(ctx, 'creation-model')
  const profileKey = optionalFlag(ctx, 'profile') ?? PROFILE_DEFAULT
  const description = requiredFlag(ctx, 'description')
  const previewText = requiredFlag(ctx, 'preview-text')
  const candidateCount = positiveIntegerFlag(ctx, 'candidates', provider === 'elevenlabs' ? 3 : 1)
  const sourceVoiceId = optionalFlag(ctx, 'source-voice-id')
  const eligibilitySnapshotHash = optionalFlag(ctx, 'eligibility-snapshot-hash')
  if ((sourceVoiceId || eligibilitySnapshotHash) && provider !== 'elevenlabs') throw CLIUsageError('Voice remix is supported only by the ElevenLabs advanced adapter.')
  if ((sourceVoiceId && !eligibilitySnapshotHash) || (!sourceVoiceId && eligibilitySnapshotHash)) throw CLIUsageError('ElevenLabs remix requires both --source-voice-id and --eligibility-snapshot-hash.')
  if (eligibilitySnapshotHash && !/^[a-f0-9]{64}$/.test(eligibilitySnapshotHash)) throw CLIUsageError('--eligibility-snapshot-hash must be a lowercase SHA-256 digest.')
  const seedRaw = optionalFlag(ctx, 'seed')
  const seed = seedRaw === undefined ? undefined : Number(seedRaw)
  if (seed !== undefined && (!Number.isInteger(seed) || seed < 0)) throw CLIUsageError('--seed must be a non-negative integer.')
  if (provider === 'elevenlabs') {
    if (candidateCount > 3) throw CLIUsageError('ElevenLabs Voice Design supports one to three bounded previews per operation.')
    if (description.length < 20 || description.length > 1000) throw CLIUsageError('ElevenLabs Voice Design description must contain 20-1000 characters.')
    if (previewText.length < 100 || previewText.length > 1000) throw CLIUsageError('ElevenLabs Voice Design preview text must contain 100-1000 characters.')
  } else if (provider === 'hume') {
    if (creationModel !== 'octave-1') throw CLIUsageError('Hume Voice Design requires creation model octave-1 even when the saved voice will synthesize with Octave 2.')
    if (candidateCount > 5) throw CLIUsageError('Hume Voice Design supports one to five candidates per bounded request.')
    if (description.length > 1000) throw CLIUsageError('Hume Voice Design description must contain 1-1000 characters.')
    if (seed !== undefined) throw CLIUsageError('Hume Voice Design does not expose a deterministic seed.')
  } else {
    if (candidateCount !== 1) throw CLIUsageError('MiniMax Voice Design returns exactly one bounded preview per request.')
    if (previewText.length > 500) throw CLIUsageError('MiniMax Voice Design preview text must contain 1-500 characters.')
    if (seed !== undefined) throw CLIUsageError('MiniMax Voice Design does not expose a deterministic seed.')
  }
  await requireBrief(subjectKey, profileKey)
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: sourceVoiceId ? 'voice-remix-candidates' : 'voice-design-candidates', provider, providerModel, creationModel, candidateCount, estimatedCostCents: null, pricing: 'provider-conditional', mutation: false, providerCalls: 0 }, null, 2))
    return
  }
  await assertProtectedStoreOutputDisjoint(getCharactersRoot(), MANAGED_VOICE_STORE_ROOT)
  const adapter = advancedProvider(provider)
  const sourceVoice = sourceVoiceId ? {
    kind: 'remote-resource' as const,
    provider,
    resourceId: sourceVoiceId,
    namespace: 'account' as const,
    accountScopeHash: adapter.accountScopeHash,
    origin: 'imported-custom' as const,
    ownership: 'account' as const,
    deletion: { state: 'external-only' as const, checkedAt: new Date().toISOString() }
  } : undefined
  const candidates = await createAdvancedVoiceCandidates({
    charactersRoot: getCharactersRoot(), protectedStore: managedVoiceAssetStore, provider: adapter, providerModel, creationModel,
    subjectKey, profileKey, description, previewText, candidateCount,
    ...(sourceVoice ? { sourceVoice, eligibilitySnapshotHash } : {}),
    ...(seed !== undefined ? { seed } : {})
  })
  console.log(JSON.stringify({ schemaVersion: 1, provider, candidates: candidates.map(candidate => ({ candidateId: candidate.candidateId, registrationDraftId: candidate.registrationDraftId, previewAssets: candidate.previewAssets, expiryState: candidate.expiryState })) }, null, 2))
}

const handleMaterialize = async (ctx: CliCommandContext): Promise<void> => {
  const candidateId = parameter(ctx, 'candidateId')
  const candidate = await loadVoiceCandidate(getCharactersRoot(), candidateId)
  const provider = providerFlag(ctx)
  if (provider !== candidate.provider || !isDesignProvider(provider)) throw CLIUsageError('Candidate materialization provider does not match an ElevenLabs, Hume, or MiniMax candidate.')
  const subjectKey = requiredFlag(ctx, 'subject-key')
  const profileKey = optionalFlag(ctx, 'profile') ?? PROFILE_DEFAULT
  const brief = await requireBrief(subjectKey, profileKey)
  const desiredName = requiredFlag(ctx, 'voice-name')
  const provenanceRef = requiredFlag(ctx, 'provenance-ref')
  const consentRef = optionalFlag(ctx, 'consent-ref')
  const consent = await optionalConsent(consentRef)
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'voice-materialize-candidate', provider, candidateId, estimatedCostCents: null, pricing: 'provider-conditional', mutation: false, providerCalls: 0 }, null, 2))
    return
  }
  await assertProtectedStoreOutputDisjoint(getCharactersRoot(), MANAGED_VOICE_STORE_ROOT)
  const adapter = advancedProvider(provider)
  const result = await materializeAdvancedVoiceCandidate({
    charactersRoot: getCharactersRoot(), journalRoot: join(MANAGED_VOICE_STORE_ROOT, 'journals'), protectedStore: managedVoiceAssetStore,
    provider: adapter, candidateId, desiredName, subjectKey, profileKey, brief,
    provenanceRef, ...(consent ? { consent, consentRecordRef: consentRef } : {}),
    capabilityFixtureHash: advancedCapabilityFixtureHash(provider),
    ...(candidate.sourceVoice ? { sourceVoice: candidate.sourceVoice, eligibilitySnapshotHash: candidate.eligibilitySnapshotHash } : {})
  })
  console.log(JSON.stringify({ candidateId: result.candidate.candidateId, registrationId: result.registration.registrationId, generationId: result.registration.generationId, state: result.registration.provisioning.state }, null, 2))
}

const handleRevokeConsent = async (ctx: CliCommandContext): Promise<void> => {
  const reference = parameter(ctx, 'consentRef')
  const actor = validateAuditActorRef({
    namespace: (optionalFlag(ctx, 'actor-namespace') ?? 'local-user') as 'local-user' | 'project-role' | 'automation',
    actorId: requiredFlag(ctx, 'actor-id')
  })
  const revocation = await revokeVoiceConsentRecord({
    store: managedVoiceAssetStore,
    reference,
    reason: requiredFlag(ctx, 'reason'),
    revokedBy: actor
  })
  console.log(JSON.stringify({ consentRecordId: revocation.consentRecordId, revocationId: revocation.revocationId, state: 'revoked' }, null, 2))
}

const handleMistralSaveReference = async (ctx: CliCommandContext): Promise<void> => {
  const subjectKey = parameter(ctx, 'subjectKey')
  const profileKey = optionalFlag(ctx, 'profile') ?? PROFILE_DEFAULT
  const model = requiredFlag(ctx, 'model')
  const sourcePath = requiredFlag(ctx, 'reference-audio')
  const authorizationRef = requiredFlag(ctx, 'authorization-ref')
  const consentRef = requiredFlag(ctx, 'consent-ref')
  const consent = await loadVoiceConsentRecord(managedVoiceAssetStore, consentRef)
  const brief = await requireBrief(subjectKey, profileKey)
  const plan = await planMistralSavedReferenceRegistration({ protectedStore: managedVoiceAssetStore, subjectKey, profileKey, providerModel: model, sourcePath, authorizationRef })
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'mistral-save-reference', estimatedCostCents: plan.estimatedCostCents, mutation: false, registrationId: plan.registrationId, sourceSha256: plan.source.sha256 }, null, 2))
    return
  }
  const registration = await provisionMistralSavedReferenceRegistration({
    charactersRoot: getCharactersRoot(), protectedStore: managedVoiceAssetStore, subjectKey, profileKey, providerModel: model,
    voiceName: requiredFlag(ctx, 'voice-name'), sourcePath, authorizationRef, brief,
    provenanceRef: requiredFlag(ctx, 'provenance-ref'), consent, consentRecordRef: consentRef,
    capabilityFixtureHash: capabilityFixtureHash(ctx, 'mistral', model), apiKey: requireApiKey('MISTRAL_API_KEY', 'voice:mistral', 'Mistral saved voice creation')
  })
  console.log(JSON.stringify({ registrationId: registration.registrationId, generationId: registration.generationId, state: registration.provisioning.state }, null, 2))
}

const findRegistration = async (registrationId: string, generationId: string) => {
  const catalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
  const registration = catalog.registrations.find(entry => entry.registrationId === registrationId && entry.generationId === generationId)
  if (!registration) throw CLIUsageError('Voice registration generation was not found.')
  return registration
}

const handleAudition = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const generationId = requiredFlag(ctx, 'generation-id')
  const registration = await findRegistration(registrationId, generationId)
  const brief = await requireBrief(registration.subjectKey, registration.profileKey)
  const consent = registration.consentRecordRef ? await optionalConsent(registration.consentRecordRef) : undefined
  if (registration.consentRecordRef) assertVoiceConsentAllows(consent, 'new-synthesis')
  const takeCount = positiveIntegerFlag(ctx, 'takes', 1)
  const representativeLine = requiredFlag(ctx, 'representative-line')
  const plan = planCanonicalVoiceAudition(registration, brief, representativeLine, takeCount)
  const maxCents = nonNegativeNumberFlag(ctx, 'max-cents')
  if (maxCents !== undefined && plan.estimatedCostCents > maxCents) throw CLIUsageError(`Canonical audition estimate ${plan.estimatedCostCents.toFixed(4)} cents exceeds --max-cents ${maxCents}.`)
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'voice-audition', estimatedCostCents: plan.estimatedCostCents, mutation: false, characterCount: plan.characterCount, takeCount }, null, 2))
    return
  }
  const { audition, auditioned } = await withProcessLock(`voice-audition-${hashCanonicalTtsValue({ registrationId, generationId }).slice(0, 32)}`, async () => {
    const currentRegistration = await findRegistration(registrationId, generationId)
    const currentCatalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
    if (currentCatalog.registrations.some(entry => entry.registrationId === registrationId && entry.priorGenerationId === generationId)) {
      throw CLIUsageError('Voice registration generation already has an append-preserved successor; inspect it instead of purchasing another audition.')
    }
    const currentBrief = await requireBrief(currentRegistration.subjectKey, currentRegistration.profileKey)
    const currentConsent = currentRegistration.consentRecordRef ? await loadVoiceConsentRecord(managedVoiceAssetStore, currentRegistration.consentRecordRef) : undefined
    const generated = await runCanonicalVoiceAudition({ registration: currentRegistration, brief: currentBrief, representativeLine, protectedStore: managedVoiceAssetStore, consent: currentConsent, takeCount, maxCents })
    const recorded = await recordVoiceAudition({ charactersRoot: getCharactersRoot(), registrationId, generationId, audition: generated })
    return { audition: generated, auditioned: recorded }
  })
  console.log(JSON.stringify({ auditionId: audition.auditionId, registrationId, generationId: auditioned.generationId, state: auditioned.approval.state }, null, 2))
}

const handleApprove = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const generationId = requiredFlag(ctx, 'generation-id')
  const registration = await findRegistration(registrationId, generationId)
  if (registration.approval.state !== 'auditioned') throw CLIUsageError('Voice approval requires an auditioned registration generation.')
  const audition = await loadVoiceAuditionManifestForRegistration(getCharactersRoot(), registrationId, generationId)
  const catalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
  const current = await loadCurrentVoiceRegistrationIndex(getCharactersRoot(), catalog)
  const prior = current.selections.find(entry => entry.subjectKey === registration.subjectKey && entry.provider === registration.provider && entry.profileKey === registration.profileKey)
  const actor = validateAuditActorRef({ namespace: 'local-user', actorId: requiredFlag(ctx, 'actor-id') })
  const consent = registration.consentRecordRef ? await loadVoiceConsentRecord(managedVoiceAssetStore, registration.consentRecordRef) : undefined
  const approved = await approveVoiceRegistration({
    charactersRoot: getCharactersRoot(), registrationId, generationId, audition, approvedBy: actor,
    expectedIndexRevision: current.revision, ...(prior ? { expectedCurrentGenerationId: prior.generationId } : {}), ...(consent ? { consent } : {})
  })
  console.log(JSON.stringify({ registrationId, generationId: approved.generationId, state: approved.approval.state }, null, 2))
}

const handleStatus = async (): Promise<void> => {
  const catalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
  const current = await loadCurrentVoiceRegistrationIndex(getCharactersRoot(), catalog)
  console.log(JSON.stringify({ schemaVersion: 1, registrations: catalog.registrations, current }, null, 2))
}

const handleInspect = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const generationId = requiredFlag(ctx, 'generation-id')
  const registration = await findRegistration(registrationId, generationId)
  if (registration.consentRecordRef) {
    const consent = await loadVoiceConsentRecord(managedVoiceAssetStore, registration.consentRecordRef)
    assertVoiceConsentAllows(consent, 'new-synthesis')
  }
  const staticOnly = ctx.flags['price'] === true
  if (!staticOnly && isAdvancedProvider(registration.provider) && registration.provisioning.state === 'ready') {
    const adapter = advancedProvider(registration.provider)
    const inspection = await adapter.lifecycle?.inspect(registration.provisioning.providerVoice)
    console.log(JSON.stringify({ registrationId, generationId, staticOnly: false, inspection, mutation: false }, null, 2))
    return
  }
  const requiresMistralRead = !staticOnly
    && registration.provider === 'mistral'
    && registration.provisioning.state === 'ready'
    && registration.provisioning.providerVoice.kind === 'remote-resource'
    && registration.provisioning.providerVoice.namespace === 'account'
  const readiness = await inspectVoiceRegistrationReadiness({
    registration,
    staticOnly,
    ...(requiresMistralRead ? { apiKey: requireApiKey('MISTRAL_API_KEY', 'voice:mistral', 'Mistral saved voice readiness inspection') } : {})
  })
  console.log(JSON.stringify({ ...readiness, mutation: false }, null, 2))
}

const handleReconcile = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const generationId = requiredFlag(ctx, 'generation-id')
  const registration = await findRegistration(registrationId, generationId)
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'voice-reconcile', estimatedCostCents: 0, mutation: false, registrationId, generationId }, null, 2))
    return
  }
  const reconciled = await reconcileMistralSavedReferenceRegistration({
    charactersRoot: getCharactersRoot(),
    registration,
    apiKey: requireApiKey('MISTRAL_API_KEY', 'voice:mistral', 'Mistral saved voice reconciliation')
  })
  console.log(JSON.stringify({ registrationId, generationId: reconciled.generationId, state: reconciled.provisioning.state }, null, 2))
}

const handleLifecycle = async (ctx: CliCommandContext, action: 'retire' | 'revoke'): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const generationId = requiredFlag(ctx, 'generation-id')
  const reason = optionalFlag(ctx, 'reason')
  if (action === 'revoke' && !reason) throw CLIUsageError('--reason is required for voice revocation.')
  const transitioned = await transitionVoiceRegistrationLifecycle({
    charactersRoot: getCharactersRoot(), registrationId, generationId, action, ...(reason ? { reason } : {})
  })
  console.log(JSON.stringify({ registrationId, generationId: transitioned.generationId, state: transitioned.approval.state, cleanupState: transitioned.cleanupState.state }, null, 2))
}

const handleDelete = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const generationId = requiredFlag(ctx, 'generation-id')
  const registration = await findRegistration(registrationId, generationId)
  if (!(registration.provider === 'mistral' || isAdvancedProvider(registration.provider)) || registration.provisioning.state !== 'ready' || registration.provisioning.providerVoice.kind !== 'remote-resource') {
    throw CLIUsageError('Voice deletion supports only ready Mistral, ElevenLabs, Hume, MiniMax, Cartesia, or Speechify remote-resource registrations.')
  }
  const providerVoice = registration.provisioning.providerVoice
  const confirmResourceId = requiredFlag(ctx, 'confirm-voice-id')
  const expectedHumeName = registration.provider === 'hume' ? requiredFlag(ctx, 'expected-name') : undefined
  if (confirmResourceId !== providerVoice.resourceId) throw CLIUsageError('--confirm-voice-id must match the exact registered provider resource ID.')
  if (providerVoice.ownership !== 'project' || providerVoice.deletion.state !== 'eligible') throw CLIUsageError('Voice deletion is allowed only for an eligibility-checked project-owned resource.')
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'voice-delete', estimatedCostCents: 0, mutation: false, registrationId, generationId, resourceId: providerVoice.resourceId }, null, 2))
    return
  }
  const wasPending = registration.cleanupState.state === 'deletion-pending'
  const pending = wasPending
    ? registration
    : await beginVoiceRegistrationDeletion({ charactersRoot: getCharactersRoot(), registrationId, generationId })
  if (pending.provisioning.state !== 'ready' || pending.provisioning.providerVoice.kind !== 'remote-resource') throw CLIUsageError('Pending deletion lost its exact provider voice identity.')
  let deleted: { deletedAt: string }
  if (pending.provider === 'mistral') {
    const apiKey = requireApiKey('MISTRAL_API_KEY', 'voice:mistral', 'Mistral saved voice deletion')
    if (pending.provisioning.providerVoice.accountScopeHash !== mistralAccountScopeHash(apiKey)) throw CLIUsageError('Mistral deletion credentials do not match the registered account scope.')
    const alreadyMissing = wasPending && !await inspectMistralSavedVoiceIfPresent({ apiKey, voiceId: pending.provisioning.providerVoice.resourceId })
    deleted = alreadyMissing ? { deletedAt: new Date().toISOString() } : await deleteMistralSavedVoice({ apiKey, providerVoice: pending.provisioning.providerVoice, confirmResourceId })
  } else {
    if (!isAdvancedProvider(pending.provider)) throw CLIUsageError(`${pending.provider} lifecycle adapter is unavailable.`)
    const adapter = advancedProvider(pending.provider)
    if (!adapter.lifecycle) throw CLIUsageError(`${pending.provider} lifecycle adapter is unavailable.`)
    deleted = await adapter.lifecycle.delete({
      providerVoice: pending.provisioning.providerVoice,
      expectedResourceId: confirmResourceId,
      ...(pending.provider === 'hume' ? { expectedName: expectedHumeName } : {})
    })
  }
  const terminal = await transitionVoiceRegistrationLifecycle({
    charactersRoot: getCharactersRoot(), registrationId, generationId: pending.generationId, action: 'delete', transitionedAt: deleted.deletedAt
  })
  console.log(JSON.stringify({ registrationId, generationId: terminal.generationId, state: terminal.provisioning.state }, null, 2))
}

const consentCommand = defineCliCommand({
  name: 'voice consent', description: 'Create a protected consent policy record with explicit per-action grants',
  parameters: [{ key: '<subject-key>', description: 'Canonical character or role key' }],
  flags: {
    'provenance-ref': commonRegistrationFlags['provenance-ref'], allow: strFlag(`Comma-separated grants: ${CONSENT_ACTIONS.join(',')}`),
    evidence: strFlag('Optional consent evidence file kept only in the protected store'),
    'actor-namespace': strFlag('Audit actor namespace: local-user|project-role|automation', 'local-user'),
    'actor-id': strFlag('Opaque audit actor ID'), price: commonRegistrationFlags.price
  }
}, handleConsent)

const importCommand = defineCliCommand({
  name: 'voice import', description: 'Register an existing provider voice without creating a remote resource',
  parameters: [{ key: '<subject-key>', description: 'Canonical character or role key' }],
  flags: {
    ...commonRegistrationFlags, 'voice-id': strFlag('Existing provider voice ID'),
    origin: strFlag(`Voice origin: ${VOICE_ORIGINS.join('|')}`, 'provider-stock'),
    'account-scope-hash': strFlag('Required SHA-256 account scope for account-namespaced voices')
  }
}, handleImport)

const discoverCommand = defineCliCommand({
  name: 'voice discover', description: 'Read provider/account voice catalogs without creating or changing resources',
  flags: {
    provider: commonRegistrationFlags.provider,
    source: strFlag('Catalog source: account|provider-library|shared-library', 'account'),
    cursor: strFlag('Opaque provider pagination cursor'),
    price: commonRegistrationFlags.price
  }
}, handleDiscover)

const designCommand = defineCliCommand({
  name: 'voice design', description: 'Generate bounded protected ElevenLabs, Hume, or MiniMax voice candidates without approving one',
  parameters: [{ key: '<subject-key>', description: 'Canonical character or role key' }],
  flags: {
    provider: commonRegistrationFlags.provider, model: commonRegistrationFlags.model, profile: commonRegistrationFlags.profile,
    'creation-model': strFlag('Provider model used only to create candidates'), description: strFlag('Provider voice design/remix description'),
    'preview-text': strFlag('100-1000 character preview passage'), candidates: strFlag('Bounded candidate count'), seed: strFlag('Optional non-negative deterministic seed'),
    'source-voice-id': strFlag('ElevenLabs remix source voice ID'), 'eligibility-snapshot-hash': strFlag('Dated ElevenLabs remix eligibility proof SHA-256'),
    price: commonRegistrationFlags.price
  }
}, handleDesign)

const materializeCommand = defineCliCommand({
  name: 'voice materialize', description: 'Materialize exactly one selected advanced-provider candidate through a durable provisioning journal',
  parameters: [{ key: '<candidate-id>', description: 'Create-only local voice candidate ID' }],
  flags: {
    provider: commonRegistrationFlags.provider, 'subject-key': strFlag('Canonical character or role key'), profile: commonRegistrationFlags.profile,
    'voice-name': strFlag('Desired provider account voice name'), 'provenance-ref': commonRegistrationFlags['provenance-ref'],
    'consent-ref': commonRegistrationFlags['consent-ref'], price: commonRegistrationFlags.price
  }
}, handleMaterialize)

const revokeConsentCommand = defineCliCommand({
  name: 'voice revoke-consent', description: 'Append a protected revocation marker that denies all use of a consent record',
  parameters: [{ key: '<consent-ref>', description: 'Protected consent-record locator' }],
  flags: {
    reason: strFlag('Required non-sensitive revocation reason'),
    'actor-namespace': strFlag('Audit actor namespace: local-user|project-role|automation', 'local-user'),
    'actor-id': strFlag('Opaque audit actor ID')
  }
}, handleRevokeConsent)

const saveReferenceCommand = defineCliCommand({
  name: 'voice save-reference', description: 'Create one crash-safe Mistral saved voice from authorized protected reference audio',
  parameters: [{ key: '<subject-key>', description: 'Canonical character or role key' }],
  flags: {
    model: commonRegistrationFlags.model, profile: commonRegistrationFlags.profile,
    'voice-name': strFlag('Mistral saved voice display name'), 'reference-audio': strFlag('Authorized local reference-audio path'),
    'authorization-ref': strFlag('Opaque authorization record reference'), 'consent-ref': commonRegistrationFlags['consent-ref'],
    'provenance-ref': commonRegistrationFlags['provenance-ref'], 'capability-fixture-hash': commonRegistrationFlags['capability-fixture-hash'],
    price: commonRegistrationFlags.price
  }
}, handleMistralSaveReference)

const auditionCommand = defineCliCommand({
  name: 'voice audition', description: 'Synthesize and protect the canonical pre-approval audition set',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: {
    'generation-id': strFlag('Ready draft registration generation SHA-256'),
    'representative-line': strFlag('Representative script line for the audition set'),
    takes: strFlag('Takes per audition passage (1-5)', '1'), 'max-cents': strFlag('Maximum authorized provider spend in cents'),
    price: commonRegistrationFlags.price
  }
}, handleAudition)

const approveCommand = defineCliCommand({
  name: 'voice approve', description: 'Atomically approve an auditioned registration and make its profile current',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: { 'generation-id': strFlag('Auditioned registration generation SHA-256'), 'actor-id': strFlag('Opaque approving actor ID') }
}, handleApprove)

const reconcileCommand = defineCliCommand({
  name: 'voice reconcile', description: 'Resolve an ambiguous Mistral provisioning attempt without repeating creation',
  parameters: [{ key: '<registration-id>', description: 'Pending voice registration ID' }],
  flags: { 'generation-id': strFlag('Pending registration generation SHA-256'), price: commonRegistrationFlags.price }
}, handleReconcile)

const retireCommand = defineCliCommand({
  name: 'voice retire', description: 'Retire a registration generation and remove it from the current index',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: { 'generation-id': strFlag('Registration generation SHA-256') }
}, async ctx => await handleLifecycle(ctx, 'retire'))

const revokeCommand = defineCliCommand({
  name: 'voice revoke', description: 'Revoke a registration and enforce its protected-asset cleanup policy',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: { 'generation-id': strFlag('Registration generation SHA-256'), reason: strFlag('Required non-sensitive revocation reason') }
}, async ctx => await handleLifecycle(ctx, 'revoke'))

const deleteCommand = defineCliCommand({
  name: 'voice delete', description: 'Explicitly delete an eligible project-owned managed voice and tombstone its registration',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: { 'generation-id': strFlag('Ready registration generation SHA-256'), 'confirm-voice-id': strFlag('Exact provider resource ID confirmation'), 'expected-name': strFlag('Fresh expected Hume custom-voice name'), price: commonRegistrationFlags.price }
}, handleDelete)

const statusCommand = defineCliCommand({ name: 'voice status', description: 'Inspect append-preserved registrations and current selections' }, handleStatus)

const inspectCommand = defineCliCommand({
  name: 'voice inspect', description: 'Inspect one registration with optional read-only provider readiness',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: { 'generation-id': strFlag('Registration generation SHA-256'), price: commonRegistrationFlags.price }
}, handleInspect)

export const voiceReferenceAliasFlags = {
  ...commonRegistrationFlags,
  'voice-id': strFlag('Existing provider voice ID'),
  origin: strFlag(`Voice origin: ${VOICE_ORIGINS.join('|')}`, 'provider-stock'),
  'account-scope-hash': strFlag('SHA-256 account scope for account-namespaced voices'),
  'voice-name': strFlag('Mistral saved voice display name'),
  'reference-audio': strFlag('Authorized local reference-audio path'),
  'authorization-ref': strFlag('Opaque authorization record reference'),
  allow: strFlag(`Comma-separated consent grants: ${CONSENT_ACTIONS.join(',')}`),
  evidence: strFlag('Optional consent evidence file kept only in the protected store'),
  'actor-namespace': strFlag('Audit actor namespace: local-user|project-role|automation', 'local-user'),
  'actor-id': strFlag('Opaque audit actor ID'),
  'generation-id': strFlag('Registration generation SHA-256'),
  'representative-line': strFlag('Representative script line for the audition set'),
  takes: strFlag('Takes per audition passage (1-5)', '1'),
  'max-cents': strFlag('Maximum authorized provider spend in cents'),
  reason: strFlag('Required non-sensitive revocation reason'),
  'confirm-voice-id': strFlag('Exact provider resource ID confirmation'),
  'expected-name': strFlag('Fresh expected Hume custom-voice name'),
  source: strFlag('Catalog source: account|provider-library|shared-library', 'account'),
  cursor: strFlag('Opaque provider pagination cursor'),
  'creation-model': strFlag('Provider model used only to create candidates'),
  description: strFlag('Provider voice design/remix description'),
  'preview-text': strFlag('Provider preview passage'),
  candidates: strFlag('Bounded candidate count'),
  seed: strFlag('Optional non-negative deterministic seed'),
  'source-voice-id': strFlag('ElevenLabs remix source voice ID'),
  'eligibility-snapshot-hash': strFlag('Dated ElevenLabs remix eligibility proof SHA-256'),
  'subject-key': strFlag('Canonical character or role key for candidate materialization')
} as const

export const VOICE_SUBCOMMAND_DEFINITIONS = [consentCommand, revokeConsentCommand, discoverCommand, importCommand, designCommand, materializeCommand, saveReferenceCommand, auditionCommand, approveCommand, inspectCommand, reconcileCommand, retireCommand, revokeCommand, deleteCommand, statusCommand] as const satisfies readonly CliCommandDefinition[]

export const voiceCommand = defineCliCommand({
  name: 'voice', description: 'Manage durable provider voice registrations separately from speech synthesis',
  subcommands: VOICE_SUBCOMMAND_DEFINITIONS,
  help: {
    examples: [
      ['bun autoshow voice import hero --provider openai --model gpt-4o-mini-tts-2025-12-15 --voice-id cedar --provenance-ref project:casting', 'Register an existing voice'],
      ['bun autoshow voice discover --provider elevenlabs --source account', 'Inspect an advanced provider voice catalog'],
      ['bun autoshow voice discover --provider cartesia --source provider-library --price', 'Validate Cartesia catalog discovery without provider calls'],
      ['bun autoshow voice design hero --provider hume --model octave-2 --creation-model octave-1 --description "Warm, weathered guide" --preview-text "A representative passage of at least one hundred characters..." --price', 'Plan bounded design candidates without provider calls'],
      ['bun autoshow voice design hero --provider minimax --model speech-2.8-hd --creation-model voice-design --description "Warm, weathered guide" --preview-text "A short representative passage." --candidates 1 --price', 'Plan one temporary MiniMax design candidate without provider calls'],
      ['bun autoshow voice audition vr_123 --generation-id SHA256 --representative-line "We leave at dawn." --price', 'Estimate a canonical audition without provider calls'],
      ['bun autoshow voice approve vr_123 --generation-id SHA256 --actor-id editor', 'Approve an audition locally']
    ],
    notes: ['ElevenLabs, Hume, MiniMax, Cartesia, and Speechify expose dated advanced capability fixtures. Cartesia and Speechify do not expose text-prompt design, and MiniMax, Cartesia, and Speechify use segmented multi-speaker rendering.', 'Voice creation, audition, approval, reconciliation, and deletion are management actions; tts, write, resume, and synthesis price never create voices.']
  }
}, async () => {})

export const voiceManagementCapabilityFixtureHash = (provider: TtsProvider, model: string): string =>
  hashCanonicalRecordWithout({ schemaVersion: 1, provider, model, phase: 'adr-020-phase-1', checkedAt: '2026-08-11' }, [])
