import type { CliCommandContext } from '~/types'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { withProcessLock } from '~/utils/process-lock'
import { UsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { planCanonicalVoiceAudition, runCanonicalVoiceAudition } from './canonical-voice-audition'
import {
  approveVoiceRegistration, beginVoiceRegistrationDeletion, loadCurrentVoiceRegistrationIndex,
  loadVoiceAuditionManifestForRegistration, loadVoiceRegistrationCatalog, recordVoiceAudition,
  resolveRegistrationGeneration, transitionVoiceRegistrationLifecycle
} from './character-voice-registry'
import { managedVoiceAssetStore } from './managed-voice-store'
import { loadVoiceConsentRecord } from './voice-consent-store'
import { inspectVoiceRegistrationReadiness } from './voice-registration-management'
import { assertVoiceConsentAllows, validateAuditActorRef } from './voice-management-contracts'
import { handleDiscover } from './voice-command-consent-import-handlers'
import {
  VOICE_PROVIDERS, advancedProvider, isVoiceProvider, maybeCompleteRegistrationJournal,
  nonNegativeNumberFlag, optionalConsent, optionalFlag, optionalParameter, parameter,
  positiveIntegerFlag, reportVoicePrice, reportVoiceResult, requireBrief, requiredFlag
} from './voice-command-support'

export const findRegistration = async (registrationId: string, generationId?: string) =>
  await resolveRegistrationGeneration(getCharactersRoot(), registrationId, generationId)

export const approveRegistration = async (registrationId: string, generationId: string, actorId: string) => {
  const registration = await findRegistration(registrationId, generationId)
  if (registration.approval.state !== 'auditioned') throw UsageError('Voice approval requires an auditioned registration generation.')
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

export const handleAudition = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const approve = ctx.flags['approve'] === true
  if (approve) requiredFlag(ctx, 'actor-id')
  const registration = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
  const generationId = registration.generationId
  if (!isVoiceProvider(registration.provider)) throw UsageError(`Voice audition supports only ${VOICE_PROVIDERS.join(', ')} registrations.`)
  const brief = await requireBrief(registration.subjectKey, registration.profileKey)
  const consent = registration.consentRecordRef ? await optionalConsent(registration.consentRecordRef) : undefined
  if (registration.consentRecordRef) assertVoiceConsentAllows(consent, 'new-synthesis')
  const takeCount = positiveIntegerFlag(ctx, 'takes', 1)
  const representativeLine = requiredFlag(ctx, 'representative-line')
  const plan = planCanonicalVoiceAudition(registration, brief, representativeLine, takeCount)
  const maxCents = nonNegativeNumberFlag(ctx, 'max-cents')
  if (maxCents !== undefined && plan.estimatedCostCents > maxCents) throw UsageError(`Canonical audition estimate ${plan.estimatedCostCents.toFixed(4)} cents exceeds --max-cents ${maxCents}.`)
  if (ctx.flags['price'] === true) {
    reportVoicePrice('Voice audition estimate', { operation: 'voice-audition', estimatedCostCents: plan.estimatedCostCents, mutation: false, characterCount: plan.characterCount, takeCount })
    return
  }
  const { audition, auditioned } = await withProcessLock(`voice-audition-${hashCanonicalTtsValue({ registrationId, generationId }).slice(0, 32)}`, async () => {
    const currentRegistration = await findRegistration(registrationId, generationId)
    const currentCatalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
    if (currentCatalog.registrations.some(entry => entry.registrationId === registrationId && entry.priorGenerationId === generationId)) {
      throw UsageError('Voice registration generation already has an append-preserved successor; inspect it instead of purchasing another audition.')
    }
    const currentBrief = await requireBrief(currentRegistration.subjectKey, currentRegistration.profileKey)
    const currentConsent = currentRegistration.consentRecordRef ? await loadVoiceConsentRecord(managedVoiceAssetStore, currentRegistration.consentRecordRef) : undefined
    const generated = await runCanonicalVoiceAudition({ registration: currentRegistration, brief: currentBrief, representativeLine, protectedStore: managedVoiceAssetStore, consent: currentConsent, takeCount, maxCents })
    const recorded = await recordVoiceAudition({ charactersRoot: getCharactersRoot(), registrationId, generationId, audition: generated })
    return { audition: generated, auditioned: recorded }
  })
  reportVoiceResult('Voice audition recorded', { auditionId: audition.auditionId, registrationId, generationId: auditioned.generationId, state: auditioned.approval.state })
  if (approve) {
    const approved = await approveRegistration(registrationId, auditioned.generationId, requiredFlag(ctx, 'actor-id'))
    reportVoiceResult('Voice registration approved', { registrationId, generationId: approved.generationId, state: approved.approval.state })
  }
}

export const handleApprove = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const registration = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
  const approved = await approveRegistration(registrationId, registration.generationId, requiredFlag(ctx, 'actor-id'))
  reportVoiceResult('Voice registration approved', { registrationId, generationId: approved.generationId, state: approved.approval.state })
}

export const handleStatus = async (): Promise<void> => {
  const catalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
  const current = await loadCurrentVoiceRegistrationIndex(getCharactersRoot(), catalog)
  reportVoiceResult('Voice registration catalog', { schemaVersion: 1, registrations: catalog.registrations, current })
}

export const handleInspect = async (ctx: CliCommandContext, options: { live?: boolean } = {}): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const registration = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
  const generationId = registration.generationId
  if (registration.consentRecordRef) {
    const consent = await loadVoiceConsentRecord(managedVoiceAssetStore, registration.consentRecordRef)
    assertVoiceConsentAllows(consent, 'new-synthesis')
  }
  if (!isVoiceProvider(registration.provider)) throw UsageError(`Voice inspect supports only ${VOICE_PROVIDERS.join(', ')} registrations.`)
  const staticOnly = ctx.flags['price'] === true
  if (options.live === true && !staticOnly && registration.provisioning.state === 'ready') {
    const adapter = advancedProvider(registration.provider)
    const inspection = await adapter.lifecycle?.inspect(registration.provisioning.providerVoice)
    reportVoiceResult('Voice registration inspection', { registrationId, generationId, staticOnly: false, inspection, mutation: false })
    return
  }
  const readiness = await inspectVoiceRegistrationReadiness({
    registration,
    staticOnly,
  })
  reportVoiceResult('Voice registration readiness', { ...readiness, mutation: false })
}

export const handleList = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = optionalParameter(ctx, 'registrationId')
  const provider = optionalFlag(ctx, 'provider')
  const live = ctx.flags['live'] === true
  if (registrationId && provider) throw UsageError('--provider cannot be combined with a registration id.')
  if (live && !registrationId) throw UsageError('--live requires a registration id.')
  if (provider) {
    await handleDiscover(ctx)
    return
  }
  if (ctx.rawParsed.explicitFlags.has('source') || optionalFlag(ctx, 'cursor')) {
    throw UsageError('--provider is required.')
  }
  if (ctx.flags['reconcile'] === true && !registrationId) throw UsageError('--reconcile requires a registration id.')
  if (registrationId) {
    const registration = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
    const completed = await maybeCompleteRegistrationJournal(registration, ctx)
    if (completed) {
      reportVoiceResult('Voice provisioning reconciled', { registrationId: completed.registrationId, generationId: completed.generationId, state: completed.provisioning.state })
      return
    }
    await handleInspect(ctx, { live })
    return
  }
  await handleStatus()
}

export const handleLifecycle = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const registration = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
  const generationId = registration.generationId
  const reason = optionalFlag(ctx, 'reason')
  const resolved = reason ? 'revoke' : 'retire'
  const transitioned = await transitionVoiceRegistrationLifecycle({
    charactersRoot: getCharactersRoot(), registrationId, generationId, action: resolved, ...(reason ? { reason } : {})
  })
  reportVoiceResult('Voice lifecycle transitioned', { registrationId, generationId: transitioned.generationId, state: transitioned.approval.state, cleanupState: transitioned.cleanupState.state })
}

export const handleDelete = async (ctx: CliCommandContext): Promise<void> => {
  const registrationId = parameter(ctx, 'registrationId')
  const source = await findRegistration(registrationId, optionalFlag(ctx, 'generation-id'))
  const completed = ctx.flags['price'] === true ? undefined : await maybeCompleteRegistrationJournal(source, ctx)
  const registration = completed ?? source
  const generationId = registration.generationId
  if (!isVoiceProvider(registration.provider) || registration.provisioning.state !== 'ready' || registration.provisioning.providerVoice.kind !== 'remote-resource') {
    throw UsageError(`Voice deletion supports only ready ${VOICE_PROVIDERS.join(', ')} remote-resource registrations.`)
  }
  const providerVoice = registration.provisioning.providerVoice
  const confirmResourceId = requiredFlag(ctx, 'confirm-voice-id')
  if (confirmResourceId !== providerVoice.resourceId) throw UsageError('--confirm-voice-id must match the exact registered provider resource ID.')
  if (providerVoice.ownership !== 'project' || providerVoice.deletion.state !== 'eligible') throw UsageError('Voice deletion is allowed only for an eligibility-checked project-owned resource.')
  if (ctx.flags['price'] === true) {
    reportVoicePrice('Voice delete estimate', { operation: 'voice-delete', estimatedCostCents: 0, mutation: false, registrationId, generationId, resourceId: providerVoice.resourceId })
    return
  }
  const pending = registration.cleanupState.state === 'deletion-pending'
    ? registration
    : await beginVoiceRegistrationDeletion({ charactersRoot: getCharactersRoot(), registrationId, generationId })
  if (pending.provisioning.state !== 'ready' || pending.provisioning.providerVoice.kind !== 'remote-resource' || !isVoiceProvider(pending.provider)) throw UsageError('Pending deletion lost its exact provider voice identity.')
  const adapter = advancedProvider(pending.provider)
  if (!adapter.lifecycle) throw UsageError(`${pending.provider} lifecycle adapter is unavailable.`)
  const deleted = await adapter.lifecycle.delete({
    providerVoice: pending.provisioning.providerVoice,
    expectedResourceId: confirmResourceId,
  })
  const terminal = await transitionVoiceRegistrationLifecycle({
    charactersRoot: getCharactersRoot(), registrationId, generationId: pending.generationId, action: 'delete', transitionedAt: deleted.deletedAt
  })
  reportVoiceResult('Voice registration deleted', { registrationId, generationId: terminal.generationId, state: terminal.provisioning.state })
}
