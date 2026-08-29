import { join } from 'node:path'
import type { CliCommandContext } from '~/types'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { getTtsPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { assertProtectedStoreOutputDisjoint } from '../voice-assets/protected-output-boundary'
import { UsageError } from '~/utils/error-handler'
import { resolveCredential } from '~/utils/validate/env-utils'
import { createAdvancedVoiceCandidates, loadVoiceCandidate, materializeAdvancedVoiceCandidate } from './advanced-voice-management'
import { loadVoiceRegistrationCatalog } from './character-voice-registry'
import { classifyProvisioningJournal, finalizePendingVoiceProvisioningAttempt } from './fish-voice-reconciliation'
import { managedVoiceAssetStore, MANAGED_VOICE_STORE_ROOT } from './managed-voice-store'
import { listVoiceProvisioningAttempts } from './provisioning-journal'
import { validateVoiceDesignRequest } from './voice-design-request-validation'
import {
  DESIGN_PROVIDERS, PROFILE_DEFAULT, advancedCapabilityFixtureHash, advancedProvider, cloneMediaType,
  isDesignProvider, maybeCompleteRegistrationJournal, optionalConsent, optionalFlag, optionalParameter,
  parameter, positiveIntegerFlag, providerFlag, reportVoicePrice, reportVoiceResult, requireBrief,
  requiredFlag, requireVoiceModel, voiceJournalRoot
} from './voice-command-support'

export const DESIGN_PREVIEW_FLAGS = ['description', 'preview-text', 'candidates', 'seed', 'source-voice-id', 'creation-model'] as const

export const handleDesign = async (ctx: CliCommandContext): Promise<void> => {
  const saveId = optionalFlag(ctx, 'save')
  if (ctx.flags['reconcile'] === true && !saveId) throw UsageError('--reconcile is only valid with --save.')
  if (saveId) {
    const mixed = DESIGN_PREVIEW_FLAGS.filter(name => name === 'candidates' ? ctx.rawParsed.explicitFlags.has('candidates') : optionalFlag(ctx, name) !== undefined)
    if (mixed.length > 0) throw UsageError(`--save cannot be combined with ${mixed.map(name => `--${name}`).join(', ')}.`)
    await handleMaterialize({ ...ctx, flags: { ...ctx.flags, save: saveId } })
    return
  }
  const subjectKey = parameter(ctx, 'subjectKey')
  const provider = providerFlag(ctx)
  if (!isDesignProvider(provider)) throw UsageError(`Voice Design currently supports ${DESIGN_PROVIDERS.join(', ')}; the selected provider has no implemented text-prompt design adapter.`)
  const providerModel = requireVoiceModel(provider, requiredFlag(ctx, 'model'))
  const creationModel = requiredFlag(ctx, 'creation-model')
  const profileKey = optionalFlag(ctx, 'profile') ?? PROFILE_DEFAULT
  const description = requiredFlag(ctx, 'description')
  const previewText = requiredFlag(ctx, 'preview-text')
  const candidateCount = positiveIntegerFlag(ctx, 'candidates', provider === 'elevenlabs' ? 3 : 1)
  const sourceVoiceId = optionalFlag(ctx, 'source-voice-id')
  const eligibilitySnapshotHash = optionalFlag(ctx, 'eligibility-snapshot-hash')
  const { seed } = validateVoiceDesignRequest({
    provider,
    creationModel,
    description,
    previewText,
    candidateCount,
    sourceVoiceId,
    eligibilitySnapshotHash,
    seedRaw: optionalFlag(ctx, 'seed')
  })
  await requireBrief(subjectKey, profileKey)
  if (ctx.flags['price'] === true) {
    const rate = getTtsPricing(provider, providerModel).costPer1kCharsCents
    if (rate === undefined) throw UsageError(`Voice design pricing is unavailable for ${provider}/${providerModel}; provider dispatch is blocked.`)
    const estimatedCostCents = ([...previewText].length / 1000) * rate
    reportVoicePrice('Voice design estimate', { operation: sourceVoiceId ? 'voice-remix-candidates' : 'voice-design-candidates', provider, providerModel, creationModel, candidateCount, characterCount: [...previewText].length, billedGenerations: 1, estimatedCostCents, pricing: 'registry-character-rate', mutation: false, providerCalls: 0 })
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
  reportVoiceResult('Voice design candidates', { schemaVersion: 1, provider, candidates: candidates.map(candidate => ({ candidateId: candidate.candidateId, registrationDraftId: candidate.registrationDraftId, previewAssets: candidate.previewAssets, expiryState: candidate.expiryState })) })
}

export const handleMaterialize = async (ctx: CliCommandContext): Promise<void> => {
  const candidateId = optionalFlag(ctx, 'save') ?? parameter(ctx, 'candidateId')
  const subjectKey = optionalFlag(ctx, 'subject-key') ?? optionalParameter(ctx, 'subjectKey')
  if (!subjectKey) throw UsageError('--subject-key is required.')
  const desiredName = requiredFlag(ctx, 'voice-name')
  const provenanceRef = requiredFlag(ctx, 'provenance-ref')
  const provider = providerFlag(ctx)
  const candidate = await loadVoiceCandidate(getCharactersRoot(), candidateId)
  if (provider !== candidate.provider || !isDesignProvider(provider)) throw UsageError(`Candidate materialization provider must match one of: ${DESIGN_PROVIDERS.join(', ')}.`)
  const profileKey = optionalFlag(ctx, 'profile') ?? PROFILE_DEFAULT
  const brief = await requireBrief(subjectKey, profileKey)
  const consentRef = optionalFlag(ctx, 'consent-ref')
  const consent = await optionalConsent(consentRef)
  if (ctx.flags['price'] === true) {
    reportVoicePrice('Voice candidate materialization estimate', { operation: 'voice-materialize-candidate', provider, candidateId, estimatedCostCents: 0, pricing: 'no-usage-charge', mutation: false, providerCalls: 0 })
    return
  }
  const catalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
  const existing = catalog.registrations.find(entry => entry.registrationId === candidate.registrationDraftId)
  if (existing) {
    const completed = await maybeCompleteRegistrationJournal(existing, ctx)
    if (completed) {
      reportVoiceResult('Voice provisioning reconciled', { candidateId, registrationId: completed.registrationId, generationId: completed.generationId, state: completed.provisioning.state })
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
        ...(ctx.flags['reconcile'] === true && provider === 'fish' ? { apiKey: resolveCredential('fish', 'require', { stage: 'voice:fish', description: 'Fish model reconciliation' }) } : {}),
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
    ...(provider === 'deepinfra' ? { resolveDeepinfraProtectedAsset: resolveManagedProtectedAsset } : {}),
  })
  const result = await materializeAdvancedVoiceCandidate({
    charactersRoot: getCharactersRoot(), journalRoot: join(MANAGED_VOICE_STORE_ROOT, 'journals'), protectedStore: managedVoiceAssetStore,
    provider: adapter, candidateId, desiredName, subjectKey, profileKey, brief,
    provenanceRef, ...(consent ? { consent, consentRecordRef: consentRef } : {}),
    capabilityFixtureHash: advancedCapabilityFixtureHash(provider),
    ...(candidate.sourceVoice ? { sourceVoice: candidate.sourceVoice, eligibilitySnapshotHash: candidate.eligibilitySnapshotHash } : {})
  })
  reportVoiceResult('Voice candidate materialized', { candidateId: result.candidate.candidateId, registrationId: result.registration.registrationId, generationId: result.registration.generationId, state: result.registration.provisioning.state })
}
