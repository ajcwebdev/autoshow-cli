import { join } from 'node:path'
import type { VoiceIssuedResource, VoiceProvisioningAttempt, VoiceRegistration } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { createFishClient } from '~/utils/fish-client/fish-client'
import { hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { providerAccountScopeHash } from '../script-to-audio/advanced-provider-contracts'
import { recordVoiceProvisioningOutcome } from './character-voice-registry'
import { listVoiceProvisioningAttempts, loadVoiceProvisioningAttempt, reconcileVoiceProvisioningAttempt, requireVoiceProvisioningReconciliation } from './provisioning-journal'
import { MANAGED_VOICE_STORE_ROOT } from './managed-voice-store'

export const AMBIGUOUS_VOICE_REDISPATCH_MESSAGE =
  'Voice provisioning may have reached the provider; automatic redispatch is blocked pending reconciliation. Pass --reconcile to safely complete the durable attempt without recreating the voice.'

const journalRootFor = (journalRoot?: string): string =>
  journalRoot ?? join(MANAGED_VOICE_STORE_ROOT, 'journals')

export const resolveFishProvisioningAttemptId = (registration: VoiceRegistration): string | undefined => {
  if (typeof registration.sanitizedProviderMetadata['attemptId'] === 'string') return registration.sanitizedProviderMetadata['attemptId']
  if (registration.provisioning.state === 'pending') return registration.provisioning.operationId
  if (typeof registration.sanitizedProviderMetadata['provisioningAttemptId'] === 'string') return registration.sanitizedProviderMetadata['provisioningAttemptId']
  return undefined
}

export const classifyProvisioningJournal = (attempt: VoiceProvisioningAttempt): 'none' | 'unambiguous' | 'ambiguous' => {
  if (attempt.outcome?.state === 'ready' || attempt.outcome?.state === 'failed') return 'none'
  if (attempt.issuedResources.some(resource => resource.providerVoice.kind === 'remote-resource')) return 'unambiguous'
  if (attempt.outcome?.state === 'reconciliation-required' || attempt.transitions.some(entry => entry.phase === 'request-sent')) return 'ambiguous'
  return 'none'
}

export const loadPendingVoiceProvisioningAttempt = async (
  registration: VoiceRegistration,
  journalRoot?: string
): Promise<VoiceProvisioningAttempt | undefined> => {
  const root = journalRootFor(journalRoot)
  const attemptId = resolveFishProvisioningAttemptId(registration)
  if (attemptId) {
    try {
      return await loadVoiceProvisioningAttempt(root, registration.registrationId, attemptId)
    } catch {
      return undefined
    }
  }
  const attempts = await listVoiceProvisioningAttempts(root, registration.registrationId)
  return attempts.find(attempt => classifyProvisioningJournal(attempt) !== 'none')
}

const issuedFishResource = (
  attempt: VoiceProvisioningAttempt,
  registration: Pick<VoiceRegistration, 'provider'>
): VoiceIssuedResource | undefined =>
  attempt.issuedResources.find(resource => resource.providerVoice.provider === registration.provider)
  ?? attempt.issuedResources.find(resource => resource.providerVoice.kind === 'remote-resource')

const searchFishIssuedResource = async (
  attempt: VoiceProvisioningAttempt,
  registration: VoiceRegistration,
  apiKey: string
): Promise<VoiceIssuedResource | undefined> => {
  const title = attempt.reconciliation?.strategy === 'provider-search'
    ? attempt.reconciliation.providerHandle
    : typeof registration.sanitizedProviderMetadata['desiredName'] === 'string'
      ? registration.sanitizedProviderMetadata['desiredName']
      : undefined
  if (!title) throw CLIUsageError('Fish provisioning journal has no safe reconciliation lookup handle; refuse to recreate the model.')
  const client = createFishClient({ apiKey })
  const catalog = await client.listModels({ self: true, title, page_size: 20, page_number: 1 })
  const match = catalog.items.find(item => item.title === title)
  if (!match) return undefined
  const checkedAt = new Date().toISOString()
  return {
    providerVoice: {
      kind: 'remote-resource',
      provider: 'fish',
      resourceId: match._id,
      namespace: 'account',
      accountScopeHash: attempt.accountScopeHash,
      origin: registration.provisioning.state === 'ready' && registration.provisioning.providerVoice.kind === 'remote-resource'
        ? registration.provisioning.providerVoice.origin
        : 'instant-clone',
      ownership: 'project',
      deletion: { state: 'eligible', checkedAt },
    },
    observedAt: checkedAt,
    sanitizedResponseHash: hashCanonicalTtsValue({ provider: 'fish', modelId: match._id, title: match.title, state: match.state ?? 'trained' }),
  } satisfies VoiceIssuedResource
}

export const finalizePendingVoiceProvisioningAttempt = async (input: {
  attempt: VoiceProvisioningAttempt
  registration: Pick<VoiceRegistration, 'provider' | 'provisioning' | 'sanitizedProviderMetadata'>
  apiKey?: string | undefined
  journalRoot?: string | undefined
  allowAmbiguous: boolean
}): Promise<VoiceProvisioningAttempt | undefined> => {
  const kind = classifyProvisioningJournal(input.attempt)
  if (kind === 'none') return undefined
  if (kind === 'ambiguous' && !input.allowAmbiguous) throw CLIUsageError(AMBIGUOUS_VOICE_REDISPATCH_MESSAGE)
  const root = journalRootFor(input.journalRoot)
  let attempt = input.attempt
  if (attempt.outcome === undefined) attempt = await requireVoiceProvisioningReconciliation(root, attempt.registrationDraftId, attempt.attemptId)
  if (attempt.outcome?.state !== 'reconciliation-required') return attempt
  let issued = issuedFishResource(attempt, input.registration)
  if (!issued) {
    if (input.registration.provider !== 'fish') throw CLIUsageError('Voice reconcile currently supports fish; other providers return unsupported until their adapter is implemented.')
    const title = attempt.reconciliation?.strategy === 'provider-search'
      ? attempt.reconciliation.providerHandle
      : typeof input.registration.sanitizedProviderMetadata['desiredName'] === 'string'
        ? input.registration.sanitizedProviderMetadata['desiredName']
        : undefined
    if (!title) throw CLIUsageError('Fish provisioning journal has no safe reconciliation lookup handle; refuse to recreate the model.')
    if (!input.apiKey) throw CLIUsageError('FISH_API_KEY environment variable is required for Fish model reconciliation')
    if (providerAccountScopeHash('fish', input.apiKey) !== attempt.accountScopeHash) {
      throw CLIUsageError('Fish reconciliation credentials do not match the provisioning account scope.')
    }
    issued = await searchFishIssuedResource(attempt, input.registration as VoiceRegistration, input.apiKey)
  }
  if (issued) {
    return await reconcileVoiceProvisioningAttempt({
      journalRoot: root,
      registrationDraftId: attempt.registrationDraftId,
      attemptId: attempt.attemptId,
      outcome: { state: 'ready', providerVoice: issued.providerVoice },
      issuedResources: [issued],
      evidenceHash: issued.sanitizedResponseHash,
    })
  }
  const evidenceHash = hashCanonicalTtsValue({ provider: input.registration.provider, attemptId: attempt.attemptId, result: 'not-found' })
  return await reconcileVoiceProvisioningAttempt({
    journalRoot: root,
    registrationDraftId: attempt.registrationDraftId,
    attemptId: attempt.attemptId,
    outcome: { state: 'failed', code: 'reconciliation-not-found', message: 'No Fish voice model matched the durable provisioning handle.' },
    evidenceHash,
  })
}

export const completePendingVoiceProvisioning = async (input: {
  charactersRoot: string
  registration: VoiceRegistration
  apiKey?: string | undefined
  journalRoot?: string | undefined
  allowAmbiguous: boolean
}): Promise<VoiceRegistration | undefined> => {
  const pending = await loadPendingVoiceProvisioningAttempt(input.registration, input.journalRoot)
  if (!pending || classifyProvisioningJournal(pending) === 'none') return undefined
  const attempt = await finalizePendingVoiceProvisioningAttempt({
    attempt: pending,
    registration: input.registration,
    apiKey: input.apiKey,
    journalRoot: input.journalRoot,
    allowAmbiguous: input.allowAmbiguous,
  })
  if (!attempt?.outcome) return undefined
  return await recordVoiceProvisioningOutcome({
    charactersRoot: input.charactersRoot,
    registrationId: input.registration.registrationId,
    generationId: input.registration.generationId,
    provisioning: attempt.outcome,
    sanitizedProviderMetadata: { attemptId: attempt.attemptId, reconciliationState: attempt.outcome.state },
  })
}

export const reconcileFishModelRegistration = async (input: {
  charactersRoot: string
  registration: VoiceRegistration
  apiKey: string
  journalRoot?: string | undefined
}): Promise<VoiceRegistration> => {
  if (input.registration.provider !== 'fish') throw CLIUsageError('Only Fish model-creation reconciliation is implemented for this provider path.')
  const reconciled = await completePendingVoiceProvisioning({ ...input, allowAmbiguous: true })
  if (reconciled) return reconciled
  const attempt = await loadPendingVoiceProvisioningAttempt(input.registration, input.journalRoot)
  if (attempt?.outcome) {
    return await recordVoiceProvisioningOutcome({
      charactersRoot: input.charactersRoot,
      registrationId: input.registration.registrationId,
      generationId: input.registration.generationId,
      provisioning: attempt.outcome,
      sanitizedProviderMetadata: { attemptId: attempt.attemptId, reconciliationState: attempt.outcome.state },
    })
  }
  throw CLIUsageError('Fish registration does not identify its provisioning attempt.')
}
