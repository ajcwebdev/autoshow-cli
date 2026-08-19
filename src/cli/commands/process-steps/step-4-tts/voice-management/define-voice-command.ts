import type { CliCommandContext, CliCommandDefinition, CloneProviderName, DesignProviderName, ManagedAdvancedProvider, TtsProvider, VoiceConsentAction, VoiceConsentRecord, VoiceProviderName, VoiceRegistration } from '~/types'
import { join } from 'node:path'
import { defineCliCommand } from '~/cli/native/native-types'
import { boolFlag, strFlag, strListFlag } from '~/cli/flags/flag-utils'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { CLIUsageError } from '~/utils/error-handler'
import { requireApiKey } from '~/utils/validate/env-utils'
import { withProcessLock } from '~/utils/process-lock'
import { hashCanonicalRecordWithout, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { assertProtectedStoreOutputDisjoint } from '../voice-assets/protected-output-boundary'
import { managedVoiceAssetStore, MANAGED_VOICE_STORE_ROOT } from './managed-voice-store'
import { loadVoiceConsentRecord, revokeVoiceConsentRecord, storeVoiceConsentRecord } from './voice-consent-store'
import { importExistingVoiceRegistration, inspectVoiceRegistrationReadiness } from './voice-registration-management'
import { planCanonicalVoiceAudition, runCanonicalVoiceAudition } from './canonical-voice-audition'
import {
  approveVoiceRegistration,
  beginVoiceRegistrationDeletion,
  loadCharacterVoiceBriefCatalog,
  loadCurrentVoiceRegistrationIndex,
  loadVoiceAuditionManifestForRegistration,
  loadVoiceRegistrationCatalog,
  recordVoiceAudition,
  resolveRegistrationGeneration,
  transitionVoiceRegistrationLifecycle,
} from './character-voice-registry'
import { assertVoiceConsentAllows, computeConsentRecordId, validateAuditActorRef, validateVoiceConsentRecord } from './voice-management-contracts'
import { createElevenLabsAdvancedProvider, ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/tts-elevenlabs/elevenlabs-advanced-provider'
import { createCartesiaAdvancedProvider, CARTESIA_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/cartesia/cartesia-advanced-provider'
import { createFishAdvancedProvider, FISH_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/fish/fish-advanced-provider'
import { createSpeechifyAdvancedProvider, SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/speechify/speechify-advanced-provider'
import { createInworldAdvancedProvider, INWORLD_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/inworld/inworld-advanced-provider'
import { createAdvancedVoiceCandidates, loadVoiceCandidate, materializeAdvancedVoiceCandidate, planAdvancedClone, provisionAdvancedVoiceClone } from './advanced-voice-management'
import { classifyProvisioningJournal, completePendingVoiceProvisioning, finalizePendingVoiceProvisioningAttempt } from './fish-voice-reconciliation'
import { listVoiceProvisioningAttempts } from './provisioning-journal'
import { FISH_VOICE_DESIGN_MODEL } from '../tts-services/fish/fish-tts-request'
import { getTtsPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'

const VOICE_PROVIDERS = ['elevenlabs', 'inworld', 'fish', 'cartesia', 'speechify'] as const satisfies readonly VoiceProviderName[]
const CONSENT_ACTIONS: VoiceConsentAction[] = ['upload', 'new-synthesis', 'cache-reuse', 'resume', 'export', 'retention', 'deletion']
const VOICE_ORIGINS = ['provider-stock', 'designed', 'remixed', 'instant-clone', 'professional-clone', 'imported-custom', 'saved-reference'] as const
const PROFILE_DEFAULT = 'default'
const VOICE_SYNTHESIS_MODELS = {
  elevenlabs: 'eleven_v3',
  inworld: 'realtime-tts-2',
  fish: 's2.1-pro',
  cartesia: 'sonic-3.5-2026-05-04',
  speechify: 'simba-3.2',
} as const
const SPEECHIFY_CLONE_GENDERS = ['male', 'female', 'not_specified'] as const

const DESIGN_PROVIDERS = ['elevenlabs', 'fish', 'inworld'] as const satisfies readonly DesignProviderName[]
const CLONE_PROVIDERS = ['elevenlabs', 'inworld', 'fish', 'cartesia', 'speechify'] as const satisfies readonly CloneProviderName[]

const isVoiceProvider = (provider: TtsProvider): provider is VoiceProviderName => VOICE_PROVIDERS.includes(provider as VoiceProviderName)
const isDesignProvider = (provider: TtsProvider): provider is DesignProviderName => DESIGN_PROVIDERS.includes(provider as DesignProviderName)
const isCloneProvider = (provider: TtsProvider): provider is CloneProviderName => CLONE_PROVIDERS.includes(provider as CloneProviderName)

const advancedCapabilityFixtureHash = (provider: VoiceProviderName): string => {
  if (provider === 'elevenlabs') return ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'cartesia') return CARTESIA_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'fish') return FISH_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'inworld') return INWORLD_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  return SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
}

const advancedProvider = (provider: VoiceProviderName, options: {
  elevenLabsApiKey?: string | undefined
  inworldApiKey?: string | undefined
  resolveElevenLabsProtectedAsset?: Parameters<typeof createElevenLabsAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveFishProtectedAsset?: Parameters<typeof createFishAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveInworldProtectedAsset?: Parameters<typeof createInworldAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveCartesiaProtectedAsset?: Parameters<typeof createCartesiaAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveSpeechifyProtectedAsset?: Parameters<typeof createSpeechifyAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveSpeechifyProtectedConsent?: Parameters<typeof createSpeechifyAdvancedProvider>[0]['resolveProtectedConsent'] | undefined
} = {}): ManagedAdvancedProvider => {
  if (provider === 'elevenlabs') return createElevenLabsAdvancedProvider({ apiKey: options.elevenLabsApiKey ?? requireApiKey('ELEVENLABS_API_KEY', 'voice:elevenlabs', 'ElevenLabs voice management'), ...(options.resolveElevenLabsProtectedAsset ? { resolveProtectedAsset: options.resolveElevenLabsProtectedAsset } : {}) })
  if (provider === 'cartesia') return createCartesiaAdvancedProvider({ apiKey: requireApiKey('CARTESIA_API_KEY', 'voice:cartesia', 'Cartesia voice management'), ...(options.resolveCartesiaProtectedAsset ? { resolveProtectedAsset: options.resolveCartesiaProtectedAsset } : {}) })
  if (provider === 'fish') return createFishAdvancedProvider({ apiKey: requireApiKey('FISH_API_KEY', 'voice:fish', 'Fish voice management'), ...(options.resolveFishProtectedAsset ? { resolveProtectedAsset: options.resolveFishProtectedAsset } : {}) })
  if (provider === 'inworld') return createInworldAdvancedProvider({ apiKey: options.inworldApiKey ?? requireApiKey('INWORLD_API_KEY', 'voice:inworld', 'Inworld voice management'), ...(options.resolveInworldProtectedAsset ? { resolveProtectedAsset: options.resolveInworldProtectedAsset } : {}) })
  return createSpeechifyAdvancedProvider({
    apiKey: requireApiKey('SPEECHIFY_API_KEY', 'voice:speechify', 'Speechify voice management'),
    ...(options.resolveSpeechifyProtectedAsset ? { resolveProtectedAsset: options.resolveSpeechifyProtectedAsset } : {}),
    ...(options.resolveSpeechifyProtectedConsent ? { resolveProtectedConsent: options.resolveSpeechifyProtectedConsent } : {}),
  })
}

const commonRegistrationFlags = {
  provider: strFlag(`Voice provider: ${VOICE_PROVIDERS.join('|')}`),
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

const optionalParameter = (ctx: CliCommandContext, name: string): string | undefined => {
  const kebabName = name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
  const value = ctx.parameters[name] ?? ctx.parameters[kebabName]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const parameter = (ctx: CliCommandContext, name: string): string => {
  const value = optionalParameter(ctx, name)
  if (!value) throw CLIUsageError(`${name} is required.`)
  return value
}

const providerFlag = (ctx: CliCommandContext): VoiceProviderName => {
  const provider = requiredFlag(ctx, 'provider')
  if (!isVoiceProvider(provider as TtsProvider)) throw CLIUsageError(`Unknown voice provider ${provider}. Expected: ${VOICE_PROVIDERS.join(', ')}.`)
  return provider as VoiceProviderName
}

const requireVoiceModel = (provider: VoiceProviderName, model: string): string => {
  const expected = VOICE_SYNTHESIS_MODELS[provider]
  if (model !== expected) throw CLIUsageError(`Voice management for ${provider} requires --model ${expected}.`)
  return model
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

const repeatableFlag = (ctx: CliCommandContext, name: string): string[] => {
  const value = ctx.flags[name]
  return (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map(entry => entry.trim())
}

const handleRevokeConsent = async (ctx: CliCommandContext, reference = parameter(ctx, 'consentRef')): Promise<void> => {
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

const handleConsent = async (ctx: CliCommandContext): Promise<void> => {
  const revokeRef = optionalFlag(ctx, 'revoke')
  if (revokeRef) {
    if (optionalFlag(ctx, 'allow')) throw CLIUsageError('--revoke cannot be combined with --allow.')
    if (optionalParameter(ctx, 'subjectKey')) throw CLIUsageError('--revoke cannot be combined with a subject key.')
    await handleRevokeConsent(ctx, revokeRef)
    return
  }
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
  const model = requireVoiceModel(provider, requiredFlag(ctx, 'model'))
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
  const sourceRaw = optionalFlag(ctx, 'source') ?? 'account'
  if (sourceRaw !== 'account' && sourceRaw !== 'provider-library' && sourceRaw !== 'shared-library') throw CLIUsageError('--source must be account, provider-library, or shared-library.')
  if (sourceRaw === 'shared-library' && provider !== 'elevenlabs') throw CLIUsageError(`${provider} does not expose an ElevenLabs-style shared-owner voice-library namespace.`)
  const cursor = optionalFlag(ctx, 'cursor')
  if (cursor && provider === 'inworld') throw CLIUsageError(`${provider} voice discovery is not paginated and does not accept --cursor.`)
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'voice-discover', provider, mutation: false, providerCalls: 0, capabilityFixtureHash: advancedCapabilityFixtureHash(provider) }, null, 2))
    return
  }
  const adapter = advancedProvider(provider)
  const page = await adapter.catalog?.list({ source: sourceRaw, ...(cursor ? { cursor } : {}) })
  console.log(JSON.stringify(page, null, 2))
}

const DESIGN_PREVIEW_FLAGS = ['description', 'preview-text', 'candidates', 'seed', 'source-voice-id', 'creation-model'] as const

const voiceJournalRoot = (): string => join(MANAGED_VOICE_STORE_ROOT, 'journals')

const maybeCompleteRegistrationJournal = async (registration: VoiceRegistration, ctx: CliCommandContext) => {
  if (ctx.flags['price'] === true) return undefined
  return await completePendingVoiceProvisioning({
    charactersRoot: getCharactersRoot(),
    registration,
    journalRoot: voiceJournalRoot(),
    allowAmbiguous: ctx.flags['reconcile'] === true,
    ...(ctx.flags['reconcile'] === true && registration.provider === 'fish'
      ? { apiKey: requireApiKey('FISH_API_KEY', 'voice:fish', 'Fish model reconciliation') }
      : {}),
  })
}

const handleDesign = async (ctx: CliCommandContext): Promise<void> => {
  const saveId = optionalFlag(ctx, 'save')
  if (ctx.flags['reconcile'] === true && !saveId) throw CLIUsageError('--reconcile is only valid with --save.')
  if (saveId) {
    const mixed = DESIGN_PREVIEW_FLAGS.filter(name => name === 'candidates' ? ctx.rawParsed.explicitFlags.has('candidates') : optionalFlag(ctx, name) !== undefined)
    if (mixed.length > 0) throw CLIUsageError(`--save cannot be combined with ${mixed.map(name => `--${name}`).join(', ')}.`)
    await handleMaterialize({ ...ctx, flags: { ...ctx.flags, save: saveId } })
    return
  }
  const subjectKey = parameter(ctx, 'subjectKey')
  const provider = providerFlag(ctx)
  if (!isDesignProvider(provider)) throw CLIUsageError(`Voice Design currently supports ${DESIGN_PROVIDERS.join(', ')}; the selected provider has no implemented text-prompt design adapter.`)
  const providerModel = requireVoiceModel(provider, requiredFlag(ctx, 'model'))
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
    if (creationModel !== 'eleven_ttv_v3' && creationModel !== 'eleven_multilingual_ttv_v2') throw CLIUsageError('ElevenLabs Voice Design creation model must be eleven_ttv_v3 or eleven_multilingual_ttv_v2; synthesis model IDs such as eleven_v3 are not design model IDs.')
    if (candidateCount > 3) throw CLIUsageError('ElevenLabs Voice Design supports one to three bounded previews per operation.')
    if (description.length < 20 || description.length > 1000) throw CLIUsageError('ElevenLabs Voice Design description must contain 20-1000 characters.')
    if (previewText.length < 100 || previewText.length > 1000) throw CLIUsageError('ElevenLabs Voice Design preview text must contain 100-1000 characters.')
  } else if (provider === 'fish') {
    if (creationModel !== FISH_VOICE_DESIGN_MODEL) throw CLIUsageError('Fish Audio Voice Design creation model must be voice-design-1.')
    if (candidateCount < 1 || candidateCount > 4) throw CLIUsageError('Fish Audio Voice Design supports one to four bounded previews per request.')
    if (description.length < 1 || description.length > 2000) throw CLIUsageError('Fish Audio Voice Design description must contain 1-2000 characters.')
    if (previewText.length > 150) throw CLIUsageError('Fish Audio Voice Design preview text must contain at most 150 characters.')
  } else {
    if (candidateCount > 3) throw CLIUsageError('Inworld Voice Design supports one to three bounded previews per request.')
    if (description.length < 30 || description.length > 250) throw CLIUsageError('Inworld Voice Design description must contain 30-250 characters.')
    if (!previewText.trim()) throw CLIUsageError('Inworld Voice Design preview text cannot be blank.')
    if (seed !== undefined) throw CLIUsageError('Inworld Voice Design does not expose a deterministic seed.')
  }
  await requireBrief(subjectKey, profileKey)
  if (ctx.flags['price'] === true) {
    const rate = getTtsPricing(provider, providerModel).costPer1kCharsCents
    if (rate === undefined) throw CLIUsageError(`Voice design pricing is unavailable for ${provider}/${providerModel}; provider dispatch is blocked.`)
    const estimatedCostCents = ([...previewText].length / 1000) * rate
    console.log(JSON.stringify({ operation: sourceVoiceId ? 'voice-remix-candidates' : 'voice-design-candidates', provider, providerModel, creationModel, candidateCount, characterCount: [...previewText].length, billedGenerations: 1, estimatedCostCents, pricing: 'registry-character-rate', mutation: false, providerCalls: 0 }, null, 2))
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
  const candidateId = optionalFlag(ctx, 'save') ?? parameter(ctx, 'candidateId')
  const subjectKey = optionalFlag(ctx, 'subject-key') ?? optionalParameter(ctx, 'subjectKey')
  if (!subjectKey) throw CLIUsageError('--subject-key is required.')
  const desiredName = requiredFlag(ctx, 'voice-name')
  const provenanceRef = requiredFlag(ctx, 'provenance-ref')
  const provider = providerFlag(ctx)
  const candidate = await loadVoiceCandidate(getCharactersRoot(), candidateId)
  if (provider !== candidate.provider || !isDesignProvider(provider)) throw CLIUsageError(`Candidate materialization provider must match one of: ${DESIGN_PROVIDERS.join(', ')}.`)
  const profileKey = optionalFlag(ctx, 'profile') ?? PROFILE_DEFAULT
  const brief = await requireBrief(subjectKey, profileKey)
  const consentRef = optionalFlag(ctx, 'consent-ref')
  const consent = await optionalConsent(consentRef)
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'voice-materialize-candidate', provider, candidateId, estimatedCostCents: 0, pricing: 'no-usage-charge', mutation: false, providerCalls: 0 }, null, 2))
    return
  }
  const catalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
  const existing = catalog.registrations.find(entry => entry.registrationId === candidate.registrationDraftId)
  if (existing) {
    const completed = await maybeCompleteRegistrationJournal(existing, ctx)
    if (completed) {
      console.log(JSON.stringify({ candidateId, registrationId: completed.registrationId, generationId: completed.generationId, state: completed.provisioning.state }, null, 2))
      return
    }
  } else {
    const pending = (await listVoiceProvisioningAttempts(voiceJournalRoot(), candidate.registrationDraftId)).find(attempt => classifyProvisioningJournal(attempt) !== 'none')
    if (pending) {
      await finalizePendingVoiceProvisioningAttempt({
        attempt: pending,
        registration: { provider, provisioning: { state: 'pending', operationId: pending.attemptId }, sanitizedProviderMetadata: { desiredName } },
        journalRoot: voiceJournalRoot(),
        allowAmbiguous: ctx.flags['reconcile'] === true,
        ...(ctx.flags['reconcile'] === true && provider === 'fish' ? { apiKey: requireApiKey('FISH_API_KEY', 'voice:fish', 'Fish model reconciliation') } : {}),
      })
    }
  }
  await assertProtectedStoreOutputDisjoint(getCharactersRoot(), MANAGED_VOICE_STORE_ROOT)
  const resolveManagedProtectedAsset = async (asset: { storeId: string, assetId: string, sha256: string }) => {
    const path = await managedVoiceAssetStore.resolve(asset)
    return { bytes: new Uint8Array(await Bun.file(path).arrayBuffer()), fileName: `design-preview-${asset.assetId}.${path.split('.').pop() ?? 'audio'}`, mediaType: cloneMediaType(path) }
  }
  const adapter = advancedProvider(provider, {
    ...(provider === 'fish' ? { resolveFishProtectedAsset: resolveManagedProtectedAsset } : {}),
  })
  const result = await materializeAdvancedVoiceCandidate({
    charactersRoot: getCharactersRoot(), journalRoot: join(MANAGED_VOICE_STORE_ROOT, 'journals'), protectedStore: managedVoiceAssetStore,
    provider: adapter, candidateId, desiredName, subjectKey, profileKey, brief,
    provenanceRef, ...(consent ? { consent, consentRecordRef: consentRef } : {}),
    capabilityFixtureHash: advancedCapabilityFixtureHash(provider),
    ...(candidate.sourceVoice ? { sourceVoice: candidate.sourceVoice, eligibilitySnapshotHash: candidate.eligibilitySnapshotHash } : {})
  })
  console.log(JSON.stringify({ candidateId: result.candidate.candidateId, registrationId: result.registration.registrationId, generationId: result.registration.generationId, state: result.registration.provisioning.state }, null, 2))
}

const cloneMediaType = (path: string): string => {
  const extension = path.toLowerCase().split('.').pop()
  if (extension === 'wav' || extension === 'wave') return 'audio/wav'
  if (extension === 'mp3') return 'audio/mpeg'
  if (extension === 'm4a' || extension === 'mp4') return 'audio/mp4'
  if (extension === 'ogg') return 'audio/ogg'
  if (extension === 'flac') return 'audio/flac'
  if (extension === 'aac') return 'audio/aac'
  if (extension === 'webm') return 'audio/webm'
  throw CLIUsageError('Voice audio samples must be mp3, wav, m4a/mp4, ogg, flac, aac, or webm audio.')
}

const handleClone = async (ctx: CliCommandContext): Promise<void> => {
  const subjectKey = parameter(ctx, 'subjectKey')
  const provider = providerFlag(ctx)
  if (!isCloneProvider(provider)) throw CLIUsageError(`Voice clone currently supports ${CLONE_PROVIDERS.join(', ')}; other providers return unsupported until their adapter is implemented.`)
  const providerModel = requireVoiceModel(provider, requiredFlag(ctx, 'model'))
  const profileKey = optionalFlag(ctx, 'profile') ?? PROFILE_DEFAULT
  if (ctx.flags['price'] !== true) {
    const catalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
    for (const match of catalog.registrations.filter(entry => entry.subjectKey === subjectKey && entry.provider === provider && entry.profileKey === profileKey)) {
      const completed = await maybeCompleteRegistrationJournal(match, ctx)
      if (completed) {
        console.log(JSON.stringify({ registrationId: completed.registrationId, generationId: completed.generationId, state: completed.provisioning.state }, null, 2))
        return
      }
    }
  }
  const cloneKind = optionalFlag(ctx, 'kind') ?? 'instant'
  if (cloneKind === 'professional') throw CLIUsageError(`${provider} professional clone is a verification-gated external workflow; finish it in the provider console, then import the approved ID with voice import --voice-id.`)
  if (cloneKind !== 'instant') throw CLIUsageError('--kind must be instant.')
  const samplePaths = repeatableFlag(ctx, 'sample')
  if (samplePaths.length === 0) throw CLIUsageError(`${provider} instant voice clone requires at least one --sample.`)
  if ((provider === 'cartesia' || provider === 'speechify') && samplePaths.length !== 1) throw CLIUsageError(`${provider} instant voice clone requires exactly one --sample.`)
  const speechifyConsentName = optionalFlag(ctx, 'consent-name')
  const speechifyConsentEmail = optionalFlag(ctx, 'consent-email')
  const speechifyLocale = optionalFlag(ctx, 'locale')
  const speechifyGender = optionalFlag(ctx, 'gender')
  if (provider === 'speechify') {
    if (!speechifyConsentName || !speechifyConsentEmail) throw CLIUsageError('Speechify instant clone requires --consent-name and --consent-email.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(speechifyConsentEmail)) throw CLIUsageError('--consent-email must be a valid email address.')
    if (speechifyGender && !SPEECHIFY_CLONE_GENDERS.includes(speechifyGender as typeof SPEECHIFY_CLONE_GENDERS[number])) throw CLIUsageError(`--gender must be ${SPEECHIFY_CLONE_GENDERS.join(', ')}.`)
  } else if (speechifyConsentName || speechifyConsentEmail || speechifyLocale || speechifyGender) {
    throw CLIUsageError('--consent-name, --consent-email, --locale, and --gender are Speechify instant-clone flags.')
  }
  const consentRecordRef = requiredFlag(ctx, 'consent-ref')
  const consent = await loadVoiceConsentRecord(managedVoiceAssetStore, consentRecordRef)
  if (consent.subjectKey !== subjectKey) throw CLIUsageError('Voice clone consent subject does not match the requested subject.')
  assertVoiceConsentAllows(consent, 'upload')
  assertVoiceConsentAllows(consent, 'new-synthesis')
  const authorizationRef = requiredFlag(ctx, 'authorization-ref')
  const planned = await Promise.all(samplePaths.map(sourcePath => managedVoiceAssetStore.plan({ sourcePath, authorizationRef, speakerKey: subjectKey })))
  const request = {
    cloneKind,
    desiredName: requiredFlag(ctx, 'voice-name'),
    localAttemptId: 'price-plan',
    protectedSamples: planned.map(item => item.protectedAsset),
    consentRecordRef,
    provenanceRef: requiredFlag(ctx, 'provenance-ref'),
    ...(optionalFlag(ctx, 'description') ? { description: optionalFlag(ctx, 'description') } : {}),
  } as const
  if (ctx.flags['price'] === true) {
    const estimate = planAdvancedClone(request)
    console.log(JSON.stringify({ operation: 'voice-clone', provider, providerModel, cloneKind, sampleCount: samplePaths.length, ...estimate, mutation: false, providerCalls: 0 }, null, 2))
    return
  }
  const brief = await requireBrief(subjectKey, profileKey)
  await assertProtectedStoreOutputDisjoint(getCharactersRoot(), MANAGED_VOICE_STORE_ROOT)
  if (!managedVoiceAssetStore.ingestManaged) throw CLIUsageError('Managed protected store cannot retain clone samples.')
  const createdAt = new Date().toISOString()
  const protectedSamples = await Promise.all(samplePaths.map(async (sourcePath, index) => (await managedVoiceAssetStore.ingestManaged!({ sourcePath, authorizationRef, speakerKey: subjectKey }, {
    schemaVersion: 1, purpose: 'reference-audio', authorizationRef, retention: { mode: 'retain-until-revoked', obligationRef: request.provenanceRef }, consentRecordRef, createdAt,
  }, planned[index]?.protectedAsset)).protectedAsset))
  const resolveProtectedAsset = async (asset: typeof protectedSamples[number]) => {
      const path = await managedVoiceAssetStore.resolve(asset)
      return { bytes: new Uint8Array(await Bun.file(path).arrayBuffer()), fileName: `clone-sample-${asset.assetId}.${path.split('.').pop() ?? 'audio'}`, mediaType: cloneMediaType(path) }
  }
  const resolveSpeechifyProtectedAsset = async (asset: typeof protectedSamples[number]) => {
    const resolved = await resolveProtectedAsset(asset)
    const path = await managedVoiceAssetStore.resolve(asset)
    const durationSeconds = await getAudioDuration(path)
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw CLIUsageError('Speechify clone sample duration could not be verified before upload.')
    return { ...resolved, durationMs: Math.round(durationSeconds * 1000) }
  }
  const adapter = provider === 'elevenlabs'
    ? advancedProvider('elevenlabs', {
        elevenLabsApiKey: cloneKind === 'instant' ? requireApiKey('ELEVENLABS_API_KEY', 'voice:elevenlabs', 'ElevenLabs instant voice clone') : 'external-professional-clone-no-provider-call',
        resolveElevenLabsProtectedAsset: resolveProtectedAsset,
      })
    : provider === 'fish'
      ? advancedProvider('fish', { resolveFishProtectedAsset: resolveProtectedAsset })
      : provider === 'cartesia'
        ? advancedProvider('cartesia', { resolveCartesiaProtectedAsset: resolveProtectedAsset })
        : provider === 'speechify'
          ? advancedProvider('speechify', {
              resolveSpeechifyProtectedAsset,
              resolveSpeechifyProtectedConsent: async () => ({
                fullName: speechifyConsentName!,
                email: speechifyConsentEmail!,
                ...(speechifyLocale ? { locale: speechifyLocale } : {}),
                ...(speechifyGender ? { gender: speechifyGender as typeof SPEECHIFY_CLONE_GENDERS[number] } : {}),
              }),
            })
          : advancedProvider('inworld', {
              inworldApiKey: cloneKind === 'instant' ? requireApiKey('INWORLD_API_KEY', 'voice:inworld', 'Inworld instant voice clone') : 'external-professional-clone-no-provider-call',
              resolveInworldProtectedAsset: resolveProtectedAsset,
            })
  const { localAttemptId: _planningId, ...cloneRequest } = request
  const result = await provisionAdvancedVoiceClone({
    charactersRoot: getCharactersRoot(), journalRoot: join(MANAGED_VOICE_STORE_ROOT, 'journals'), provider: adapter, providerModel, subjectKey, profileKey, brief,
    request: { ...cloneRequest, protectedSamples }, capabilityFixtureHash: advancedCapabilityFixtureHash(provider),
  })
  console.log(JSON.stringify({ registrationId: result.registration.registrationId, generationId: result.registration.generationId, state: result.registration.provisioning.state }, null, 2))
}

const handleRevokeConsentAlias = async (ctx: CliCommandContext): Promise<void> => {
  await handleRevokeConsent(ctx, parameter(ctx, 'consentRef'))
}

const findRegistration = async (registrationId: string, generationId?: string) =>
  await resolveRegistrationGeneration(getCharactersRoot(), registrationId, generationId)

const approveRegistration = async (registrationId: string, generationId: string, actorId: string) => {
  const registration = await findRegistration(registrationId, generationId)
  if (registration.approval.state !== 'auditioned') throw CLIUsageError('Voice approval requires an auditioned registration generation.')
  const audition = await loadVoiceAuditionManifestForRegistration(getCharactersRoot(), registrationId, generationId)
  const catalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
  const current = await loadCurrentVoiceRegistrationIndex(getCharactersRoot(), catalog)
  const prior = current.selections.find(entry => entry.subjectKey === registration.subjectKey && entry.provider === registration.provider && entry.providerModel === registration.providerModel && entry.profileKey === registration.profileKey)
  const actor = validateAuditActorRef({ namespace: 'local-user', actorId })
  const consent = registration.consentRecordRef ? await loadVoiceConsentRecord(managedVoiceAssetStore, registration.consentRecordRef) : undefined
  return await approveVoiceRegistration({
    charactersRoot: getCharactersRoot(), registrationId, generationId, audition, approvedBy: actor,
    expectedIndexRevision: current.revision, ...(prior ? { expectedCurrentGenerationId: prior.generationId } : {}), ...(consent ? { consent } : {})
  })
}

const handleAudition = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const approve = ctx.flags['approve'] === true
  if (approve) requiredFlag(ctx, 'actor-id')
  const registration = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
  const generationId = registration.generationId
  if (!isVoiceProvider(registration.provider)) throw CLIUsageError(`Voice audition supports only ${VOICE_PROVIDERS.join(', ')} registrations.`)
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
  if (approve) {
    const approved = await approveRegistration(registrationId, auditioned.generationId, requiredFlag(ctx, 'actor-id'))
    console.log(JSON.stringify({ registrationId, generationId: approved.generationId, state: approved.approval.state }, null, 2))
  }
}

const handleApprove = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const registration = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
  const approved = await approveRegistration(registrationId, registration.generationId, requiredFlag(ctx, 'actor-id'))
  console.log(JSON.stringify({ registrationId, generationId: approved.generationId, state: approved.approval.state }, null, 2))
}

const handleStatus = async (): Promise<void> => {
  const catalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
  const current = await loadCurrentVoiceRegistrationIndex(getCharactersRoot(), catalog)
  console.log(JSON.stringify({ schemaVersion: 1, registrations: catalog.registrations, current }, null, 2))
}

const handleInspect = async (ctx: CliCommandContext, options: { live?: boolean } = {}): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const registration = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
  const generationId = registration.generationId
  if (registration.consentRecordRef) {
    const consent = await loadVoiceConsentRecord(managedVoiceAssetStore, registration.consentRecordRef)
    assertVoiceConsentAllows(consent, 'new-synthesis')
  }
  if (!isVoiceProvider(registration.provider)) throw CLIUsageError(`Voice inspect supports only ${VOICE_PROVIDERS.join(', ')} registrations.`)
  const staticOnly = ctx.flags['price'] === true
  if (options.live === true && !staticOnly && registration.provisioning.state === 'ready') {
    const adapter = advancedProvider(registration.provider)
    const inspection = await adapter.lifecycle?.inspect(registration.provisioning.providerVoice)
    console.log(JSON.stringify({ registrationId, generationId, staticOnly: false, inspection, mutation: false }, null, 2))
    return
  }
  const readiness = await inspectVoiceRegistrationReadiness({
    registration,
    staticOnly,
  })
  console.log(JSON.stringify({ ...readiness, mutation: false }, null, 2))
}

const handleList = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = optionalParameter(ctx, 'registrationId')
  const provider = optionalFlag(ctx, 'provider')
  const live = ctx.flags['live'] === true
  if (registrationId && provider) throw CLIUsageError('--provider cannot be combined with a registration id.')
  if (live && !registrationId) throw CLIUsageError('--live requires a registration id.')
  if (provider) {
    await handleDiscover(ctx)
    return
  }
  if (ctx.rawParsed.explicitFlags.has('source') || optionalFlag(ctx, 'cursor')) {
    throw CLIUsageError('--provider is required.')
  }
  if (ctx.flags['reconcile'] === true && !registrationId) throw CLIUsageError('--reconcile requires a registration id.')
  if (registrationId) {
    const registration = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
    const completed = await maybeCompleteRegistrationJournal(registration, ctx)
    if (completed) {
      console.log(JSON.stringify({ registrationId: completed.registrationId, generationId: completed.generationId, state: completed.provisioning.state }, null, 2))
      return
    }
    await handleInspect(ctx, { live })
    return
  }
  await handleStatus()
}

const handleReconcile = async (ctx: CliCommandContext): Promise<void> => {
  await handleList({
    ...ctx,
    flags: { ...ctx.flags, reconcile: true }
  })
}

const handleLifecycle = async (ctx: CliCommandContext, action: 'retire' | 'revoke' = 'retire'): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const registration = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
  const generationId = registration.generationId
  const reason = optionalFlag(ctx, 'reason')
  const resolved = action === 'revoke' || Boolean(reason) ? 'revoke' : 'retire'
  if (resolved === 'revoke' && !reason) throw CLIUsageError('--reason is required for voice revocation.')
  const transitioned = await transitionVoiceRegistrationLifecycle({
    charactersRoot: getCharactersRoot(), registrationId, generationId, action: resolved, ...(reason ? { reason } : {})
  })
  console.log(JSON.stringify({ registrationId, generationId: transitioned.generationId, state: transitioned.approval.state, cleanupState: transitioned.cleanupState.state }, null, 2))
}

const handleDelete = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const source = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
  const completed = ctx.flags['price'] === true ? undefined : await maybeCompleteRegistrationJournal(source, ctx)
  const registration = completed ?? source
  const generationId = registration.generationId
  if (!isVoiceProvider(registration.provider) || registration.provisioning.state !== 'ready' || registration.provisioning.providerVoice.kind !== 'remote-resource') {
    throw CLIUsageError(`Voice deletion supports only ready ${VOICE_PROVIDERS.join(', ')} remote-resource registrations.`)
  }
  const providerVoice = registration.provisioning.providerVoice
  const confirmResourceId = requiredFlag(ctx, 'confirm-voice-id')
  if (confirmResourceId !== providerVoice.resourceId) throw CLIUsageError('--confirm-voice-id must match the exact registered provider resource ID.')
  if (providerVoice.ownership !== 'project' || providerVoice.deletion.state !== 'eligible') throw CLIUsageError('Voice deletion is allowed only for an eligibility-checked project-owned resource.')
  if (ctx.flags['price'] === true) {
    console.log(JSON.stringify({ operation: 'voice-delete', estimatedCostCents: 0, mutation: false, registrationId, generationId, resourceId: providerVoice.resourceId }, null, 2))
    return
  }
  const pending = registration.cleanupState.state === 'deletion-pending'
    ? registration
    : await beginVoiceRegistrationDeletion({ charactersRoot: getCharactersRoot(), registrationId, generationId })
  if (pending.provisioning.state !== 'ready' || pending.provisioning.providerVoice.kind !== 'remote-resource' || !isVoiceProvider(pending.provider)) throw CLIUsageError('Pending deletion lost its exact provider voice identity.')
  const adapter = advancedProvider(pending.provider)
  if (!adapter.lifecycle) throw CLIUsageError(`${pending.provider} lifecycle adapter is unavailable.`)
  const deleted = await adapter.lifecycle.delete({
    providerVoice: pending.provisioning.providerVoice,
    expectedResourceId: confirmResourceId,
  })
  const terminal = await transitionVoiceRegistrationLifecycle({
    charactersRoot: getCharactersRoot(), registrationId, generationId: pending.generationId, action: 'delete', transitionedAt: deleted.deletedAt
  })
  console.log(JSON.stringify({ registrationId, generationId: terminal.generationId, state: terminal.provisioning.state }, null, 2))
}

const consentCommand = defineCliCommand({
  name: 'voice consent', description: 'Create or revoke a protected consent policy record',
  parameters: [{ key: '[subject-key]', description: 'Canonical character or role key' }],
  flags: {
    'provenance-ref': commonRegistrationFlags['provenance-ref'], allow: strFlag(`Comma-separated grants: ${CONSENT_ACTIONS.join(',')}`),
    evidence: strFlag('Optional consent evidence file kept only in the protected store'),
    revoke: strFlag('Protected consent-record locator to revoke'),
    reason: strFlag('Required non-sensitive revocation reason when --revoke is set'),
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
  },
  help: { hidden: true }
}, handleDiscover)

const designCommand = defineCliCommand({
  name: 'voice design', description: 'Generate bounded protected advanced-provider voice candidates or save one selected candidate',
  parameters: [{ key: '[subject-key]', description: 'Canonical character or role key' }],
  flags: {
    provider: commonRegistrationFlags.provider, model: commonRegistrationFlags.model, profile: commonRegistrationFlags.profile,
    'creation-model': strFlag('Provider model used only to create candidates'), description: strFlag('Provider voice design/remix description'),
    'preview-text': strFlag('100-1000 character preview passage'), candidates: strFlag('Bounded candidate count'), seed: strFlag('Optional non-negative deterministic seed'),
    'source-voice-id': strFlag('ElevenLabs remix source voice ID'), 'eligibility-snapshot-hash': strFlag('Dated ElevenLabs remix eligibility proof SHA-256'),
    save: strFlag('Candidate ID to materialize as a durable provider voice'),
    'subject-key': strFlag('Canonical character or role key when --save is set'),
    'voice-name': strFlag('Desired provider account voice name when --save is set'),
    'provenance-ref': commonRegistrationFlags['provenance-ref'],
    'consent-ref': commonRegistrationFlags['consent-ref'],
    reconcile: boolFlag('Complete an ambiguous Fish provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price
  }
}, handleDesign)

const materializeCommand = defineCliCommand({
  name: 'voice materialize', description: 'Materialize exactly one selected advanced-provider candidate through a durable provisioning journal',
  parameters: [{ key: '<candidate-id>', description: 'Create-only local voice candidate ID' }],
  flags: {
    provider: commonRegistrationFlags.provider, 'subject-key': strFlag('Canonical character or role key'), profile: commonRegistrationFlags.profile,
    'voice-name': strFlag('Desired provider account voice name'), 'provenance-ref': commonRegistrationFlags['provenance-ref'],
    'consent-ref': commonRegistrationFlags['consent-ref'],
    reconcile: boolFlag('Complete an ambiguous Fish provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price
  },
  help: { hidden: true }
}, handleMaterialize)

const cloneCommand = defineCliCommand({
  name: 'voice clone', description: 'Create a protected consent-gated instant provider voice clone',
  parameters: [{ key: '<subject-key>', description: 'Canonical character or role key' }],
  flags: {
    provider: commonRegistrationFlags.provider, model: commonRegistrationFlags.model, profile: commonRegistrationFlags.profile,
    kind: { ...strFlag('Hidden leftover clone workflow: instant|professional'), help: { hidden: true } }, 'voice-name': strFlag('Desired provider account voice name'),
    sample: strListFlag('Authorized local clone sample; repeatable for instant cloning'), 'authorization-ref': strFlag('Opaque authorization record for the clone samples'),
    description: strFlag('Optional provider-safe voice description'), 'consent-ref': commonRegistrationFlags['consent-ref'],
    'consent-name': strFlag('Speechify clone consent full name'), 'consent-email': strFlag('Speechify clone consent email'),
    locale: strFlag('Speechify clone locale'), gender: strFlag(`Speechify clone gender: ${SPEECHIFY_CLONE_GENDERS.join('|')}`),
    'provenance-ref': commonRegistrationFlags['provenance-ref'],
    reconcile: boolFlag('Complete an ambiguous Fish provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price,
  },
}, handleClone)

const revokeConsentCommand = defineCliCommand({
  name: 'voice revoke-consent', description: 'Append a protected revocation marker that denies all use of a consent record',
  parameters: [{ key: '<consent-ref>', description: 'Protected consent-record locator' }],
  flags: {
    reason: strFlag('Required non-sensitive revocation reason'),
    'actor-namespace': strFlag('Audit actor namespace: local-user|project-role|automation', 'local-user'),
    'actor-id': strFlag('Opaque audit actor ID')
  },
  help: { hidden: true }
}, handleRevokeConsentAlias)

const auditionCommand = defineCliCommand({
  name: 'voice audition', description: 'Synthesize and protect the canonical pre-approval audition set',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: {
    'generation-id': strFlag('Ready draft registration generation SHA-256'),
    'representative-line': strFlag('Representative script line for the audition set'),
    takes: strFlag('Takes per audition passage (1-5)', '1'), 'max-cents': strFlag('Maximum authorized provider spend in cents'),
    approve: boolFlag('Approve the auditioned generation in the same run'),
    'actor-id': strFlag('Opaque approving actor ID when --approve is set'),
    price: commonRegistrationFlags.price
  }
}, handleAudition)

const approveCommand = defineCliCommand({
  name: 'voice approve', description: 'Atomically approve an auditioned registration and make its profile current',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: { 'generation-id': strFlag('Auditioned registration generation SHA-256'), 'actor-id': strFlag('Opaque approving actor ID') }
}, handleApprove)

const reconcileCommand = defineCliCommand({
  name: 'voice reconcile', description: 'Resolve an ambiguous Fish provisioning attempt without repeating creation',
  parameters: [{ key: '<registration-id>', description: 'Pending voice registration ID' }],
  flags: { 'generation-id': strFlag('Pending registration generation SHA-256'), price: commonRegistrationFlags.price },
  help: { hidden: true }
}, handleReconcile)

const retireCommand = defineCliCommand({
  name: 'voice retire', description: 'Retire or revoke a registration generation and remove it from the current index',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: {
    'generation-id': strFlag('Registration generation SHA-256'),
    reason: strFlag('Revoke instead of retire and record a non-sensitive reason')
  }
}, handleLifecycle)

const revokeCommand = defineCliCommand({
  name: 'voice revoke', description: 'Revoke a registration and enforce its protected-asset cleanup policy',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: { 'generation-id': strFlag('Registration generation SHA-256'), reason: strFlag('Required non-sensitive revocation reason') },
  help: { hidden: true }
}, async ctx => await handleLifecycle(ctx, 'revoke'))

const deleteCommand = defineCliCommand({
  name: 'voice delete', description: 'Explicitly delete an eligible project-owned managed voice and tombstone its registration',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: {
    'generation-id': strFlag('Ready registration generation SHA-256'),
    'confirm-voice-id': strFlag('Exact provider resource ID confirmation'),
    reconcile: boolFlag('Complete an ambiguous Fish provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price
  }
}, handleDelete)

const statusCommand = defineCliCommand({
  name: 'voice status', description: 'Inspect append-preserved registrations and current selections',
  help: { hidden: true }
}, handleStatus)

const inspectCommand = defineCliCommand({
  name: 'voice inspect', description: 'Inspect one registration with optional read-only provider readiness',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: { 'generation-id': strFlag('Registration generation SHA-256'), price: commonRegistrationFlags.price },
  help: { hidden: true }
}, async ctx => await handleInspect(ctx, { live: true }))

const listCommand = defineCliCommand({
  name: 'voice list', description: 'List the local catalog, one registration, or a provider catalog',
  parameters: [{ key: '[registration-id]', description: 'Voice registration ID' }],
  flags: {
    'generation-id': strFlag('Registration generation SHA-256'),
    live: boolFlag('Opt-in provider readiness check for one registration'),
    provider: commonRegistrationFlags.provider,
    source: strFlag('Catalog source: account|provider-library|shared-library', 'account'),
    cursor: strFlag('Opaque provider pagination cursor'),
    reconcile: boolFlag('Complete an ambiguous Fish provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price
  }
}, handleList)

export const VOICE_SUBCOMMAND_DEFINITIONS = [listCommand, consentCommand, revokeConsentCommand, importCommand, designCommand, materializeCommand, cloneCommand, auditionCommand, approveCommand, reconcileCommand, retireCommand, revokeCommand, deleteCommand, discoverCommand, inspectCommand, statusCommand] as const satisfies readonly CliCommandDefinition[]

export const voiceActionName = (commandName: string): string =>
  commandName.startsWith('voice ') ? commandName.slice('voice '.length) : commandName

export const VOICE_ACTIONS = VOICE_SUBCOMMAND_DEFINITIONS.map((entry) => voiceActionName(entry.name))

export const VOICE_PUBLIC_ACTIONS = VOICE_SUBCOMMAND_DEFINITIONS
  .filter((entry) => entry.help?.hidden !== true)
  .map((entry) => voiceActionName(entry.name))

export const voiceCommand = defineCliCommand({
  name: 'voice', description: 'Manage durable provider voice registrations separately from speech synthesis',
  defaultSubcommand: 'list',
  subcommands: VOICE_SUBCOMMAND_DEFINITIONS,
  help: {
    examples: [
      ['bun autoshow voice list', 'Print the local registration catalog and current index'],
      ['bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting', 'Register an existing ElevenLabs voice'],
      ['bun autoshow voice list --provider elevenlabs --source account', 'Inspect an ElevenLabs account catalog'],
      ['bun autoshow voice list --provider cartesia --source provider-library --price', 'Validate Cartesia catalog discovery without provider calls'],
      ['bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "A representative passage of at least one hundred characters..." --price', 'Plan ElevenLabs Voice Design v3 without provider calls'],
      ['bun autoshow voice design hero --provider inworld --model realtime-tts-2 --creation-model realtime-tts-2 --description "Warm, weathered guide with a grounded midrange" --preview-text "A representative passage." --price', 'Plan Inworld Voice Design without provider calls'],
      ['bun autoshow voice clone hero --provider elevenlabs --model eleven_v3 --voice-name "Hero" --sample ./hero.wav --authorization-ref project:casting --consent-ref protected-consent:v1:ID --provenance-ref project:casting --price', 'Plan an ElevenLabs clone without provider calls or writes'],
      ['bun autoshow voice clone hero --provider cartesia --model sonic-3.5-2026-05-04 --voice-name "Hero" --sample ./hero.wav --authorization-ref project:casting --consent-ref protected-consent:v1:ID --provenance-ref project:casting --price', 'Plan a Cartesia instant clone without provider calls'],
      ['bun autoshow voice clone hero --provider speechify --model simba-3.2 --voice-name "Hero" --sample ./hero.wav --consent-name "Authorized Speaker" --consent-email speaker@example.com --authorization-ref project:casting --consent-ref protected-consent:v1:ID --provenance-ref project:casting --price', 'Plan a Speechify personal clone without provider calls'],
      ['bun autoshow voice clone hero --provider fish --model s2.1-pro --voice-name "Hero" --sample ./hero.wav --authorization-ref project:casting --consent-ref protected-consent:v1:ID --provenance-ref project:casting --price', 'Plan a Fish fast voice-model create without provider calls'],
      ['bun autoshow voice design hero --provider fish --model s2.1-pro --creation-model voice-design-1 --description "Warm, weathered guide" --preview-text "A short representative passage." --candidates 1 --price', 'Plan one Fish Voice Design preview without provider calls'],
      ['bun autoshow voice design --save CANDIDATE_ID --provider elevenlabs --subject-key hero --voice-name HeroGuide --provenance-ref project:casting --price', 'Plan saving one selected design candidate without provider calls'],
      ['bun autoshow voice audition vr_123 --generation-id SHA256 --representative-line "We leave at dawn." --price', 'Estimate a canonical audition without provider calls'],
      ['bun autoshow voice approve vr_123 --generation-id SHA256 --actor-id editor', 'Approve an audition locally']
    ],
    notes: [
      'Each subcommand has its own flags: bun autoshow voice <subcommand> --help',
      'Voice management supports only ElevenLabs eleven_v3, Inworld realtime-tts-2, Fish s2.1-pro, Cartesia sonic-3.5-2026-05-04, and Speechify simba-3.2. Every other TTS model stays synthesis-only through tts with an existing stock, designed, or cloned voice ID.',
      'Cartesia and Speechify expose catalog, clone, inspect, and delete. Text-prompt design is ElevenLabs, Inworld, and Fish. tts, write, resume, and synthesis price never create voices.'
    ]
  }
}, async () => {})

export const voiceManagementCapabilityFixtureHash = (provider: TtsProvider, model: string): string =>
  hashCanonicalRecordWithout({ schemaVersion: 1, provider, model, phase: 'adr-020-phase-1', checkedAt: '2026-08-11' }, [])
