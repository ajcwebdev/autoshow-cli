import type { CliCommandContext, VoiceConsentAction, VoiceConsentRecord } from '~/types'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { assertProtectedStoreOutputDisjoint } from '../voice-assets/protected-output-boundary'
import { UsageError } from '~/utils/error-handler'
import { importExistingVoiceRegistration } from './voice-registration-management'
import { managedVoiceAssetStore, MANAGED_VOICE_STORE_ROOT } from './managed-voice-store'
import { revokeVoiceConsentRecord, storeVoiceConsentRecord, validateVoiceConsentRecordRef } from './voice-consent-store'
import { computeConsentRecordId, validateAuditActorRef, validateVoiceConsentRecord } from './voice-management-contracts'
import {
  CONSENT_ACTIONS, PROFILE_DEFAULT, VOICE_ORIGINS, advancedCapabilityFixtureHash, advancedProvider,
  capabilityFixtureHash, catalogProviderFlag, optionalConsent, optionalFlag, optionalParameter, parameter, providerFlag,
  reportVoicePrice, reportVoiceResult, requireBrief, requiredFlag, requireVoiceModel, resolveVoiceImportResourceId
} from './voice-command-support'

export const handleRevokeConsent = async (ctx: CliCommandContext, reference = parameter(ctx, 'consentRef')): Promise<void> => {
  const actor = validateAuditActorRef({
    namespace: (optionalFlag(ctx, 'actor-namespace') ?? 'local-user') as 'local-user' | 'project-role' | 'automation',
    actorId: requiredFlag(ctx, 'actor-id')
  })
  const reason = requiredFlag(ctx, 'reason')
  validateVoiceConsentRecordRef(reference)
  if (ctx.flags['price'] === true) {
    reportVoicePrice('Voice consent revocation estimate', { operation: 'voice-consent-revoke', estimatedCostCents: 0, mutation: false, providerCalls: 0, consentRecordRef: reference })
    return
  }
  const revocation = await revokeVoiceConsentRecord({
    store: managedVoiceAssetStore,
    reference,
    reason,
    revokedBy: actor
  })
  reportVoiceResult('Voice consent revoked', { consentRecordId: revocation.consentRecordId, revocationId: revocation.revocationId, state: 'revoked' })
}

export const handleConsent = async (ctx: CliCommandContext): Promise<void> => {
  const revokeRef = optionalFlag(ctx, 'revoke')
  if (revokeRef) {
    if (optionalFlag(ctx, 'allow')) throw UsageError('--revoke cannot be combined with --allow.')
    if (optionalParameter(ctx, 'subjectKey')) throw UsageError('--revoke cannot be combined with a subject key.')
    await handleRevokeConsent(ctx, revokeRef)
    return
  }
  const subjectKey = parameter(ctx, 'subjectKey')
  const provenanceRef = requiredFlag(ctx, 'provenance-ref')
  const allowed = (optionalFlag(ctx, 'allow') ?? '').split(',').map(value => value.trim()).filter(Boolean)
  const unknown = allowed.filter(value => !CONSENT_ACTIONS.includes(value as VoiceConsentAction))
  if (unknown.length > 0) throw UsageError(`Unknown consent action(s): ${unknown.join(', ')}. Expected: ${CONSENT_ACTIONS.join(', ')}.`)
  if (allowed.length === 0) throw UsageError('--allow must grant at least one explicit consent action; omitted actions remain denied.')
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
      if (!managedVoiceAssetStore.ingestManaged) throw UsageError('Managed protected store does not support consent evidence.')
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
    reportVoicePrice('Voice consent estimate', { operation: 'voice-consent', estimatedCostCents: 0, mutation: false, consentRecordId: record.consentRecordId })
    return
  }
  const reference = await storeVoiceConsentRecord(managedVoiceAssetStore, record)
  reportVoiceResult('Voice consent recorded', { consentRecordId: record.consentRecordId, consentRecordRef: reference })
}

export const handleImport = async (ctx: CliCommandContext): Promise<void> => {
  const subjectKey = parameter(ctx, 'subjectKey')
  const provider = providerFlag(ctx)
  const model = requireVoiceModel(provider, requiredFlag(ctx, 'model'))
  const profileKey = optionalFlag(ctx, 'profile') ?? PROFILE_DEFAULT
  const originRaw = optionalFlag(ctx, 'origin') ?? 'provider-stock'
  if (!VOICE_ORIGINS.includes(originRaw as typeof VOICE_ORIGINS[number])) throw UsageError(`--origin must be ${VOICE_ORIGINS.join('|')}.`)
  const origin = originRaw as typeof VOICE_ORIGINS[number]
  const consentRef = optionalFlag(ctx, 'consent-ref')
  const consent = await optionalConsent(consentRef)
  const brief = await requireBrief(subjectKey, profileKey)
  const accountScopeHash = optionalFlag(ctx, 'account-scope-hash')
  if (accountScopeHash && !/^[a-f0-9]{64}$/.test(accountScopeHash)) throw UsageError('--account-scope-hash must be a lowercase SHA-256 digest.')
  if (origin !== 'provider-stock' && !accountScopeHash) throw UsageError('Account voice import requires a non-secret account scope hash.')
  const resourceId = resolveVoiceImportResourceId(provider, model, requiredFlag(ctx, 'voice-id'))
  const request = {
    charactersRoot: getCharactersRoot(), subjectKey, profileKey, provider, providerModel: model,
    resourceId, origin, brief, provenanceRef: requiredFlag(ctx, 'provenance-ref'),
    ...(consent ? { consent, consentRecordRef: consentRef } : {}),
    ...(accountScopeHash ? { accountScopeHash } : {}),
    capabilityFixtureHash: capabilityFixtureHash(ctx, provider, model)
  }
  if (ctx.flags['price'] === true) {
    reportVoicePrice('Voice import estimate', { operation: 'voice-import', estimatedCostCents: 0, mutation: false, subjectKey, provider, model })
    return
  }
  const registration = await importExistingVoiceRegistration(request)
  reportVoiceResult('Voice registration imported', { registrationId: registration.registrationId, generationId: registration.generationId, state: registration.provisioning.state })
}

export const handleDiscover = async (ctx: CliCommandContext): Promise<void> => {
  const provider = catalogProviderFlag(ctx)
  const sourceRaw = optionalFlag(ctx, 'source') ?? 'account'
  if (sourceRaw !== 'account' && sourceRaw !== 'provider-library' && sourceRaw !== 'shared-library') throw UsageError('--source must be account, provider-library, or shared-library.')
  if (sourceRaw === 'shared-library' && provider !== 'elevenlabs') throw UsageError(`${provider} does not expose an ElevenLabs-style shared-owner voice-library namespace.`)
  const cursor = optionalFlag(ctx, 'cursor')
  if (ctx.flags['price'] === true) {
    reportVoicePrice('Voice discovery estimate', { operation: 'voice-discover', provider, mutation: false, providerCalls: 0, capabilityFixtureHash: advancedCapabilityFixtureHash(provider) })
    return
  }
  const adapter = advancedProvider(provider)
  const page = await adapter.catalog?.list({ source: sourceRaw, ...(cursor ? { cursor } : {}) })
  reportVoiceResult('Voice catalog page', { ...(page ?? {}) })
}
