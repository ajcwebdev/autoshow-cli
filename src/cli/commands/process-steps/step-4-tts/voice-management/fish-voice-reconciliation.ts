import { join } from 'node:path'
import type { VoiceIssuedResource, VoiceProvisioningAttempt, VoiceRegistration } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { createFishClient } from '~/utils/fish-client/fish-client'
import { hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { providerAccountScopeHash } from '../script-to-audio/advanced-provider-contracts'
import { recordVoiceProvisioningOutcome } from './character-voice-registry'
import { listVoiceProvisioningAttempts, loadVoiceProvisioningAttempt, reconcileVoiceProvisioningAttempt, requireVoiceProvisioningReconciliation } from './provisioning-journal'
import { MANAGED_VOICE_STORE_ROOT } from './managed-voice-store'
import { resolveCredential } from '~/utils/validate/env-utils'
import { createGrokAdvancedProvider } from '../tts-services/tts-grok/grok-advanced-provider'

export const AMBIGUOUS_VOICE_REDISPATCH_MESSAGE =
  'Voice provisioning may have reached the provider; automatic redispatch is blocked pending reconciliation. Pass --reconcile to safely complete the durable attempt without recreating the voice.'

const journalRootFor = (journalRoot?: string): string =>
  journalRoot ?? join(MANAGED_VOICE_STORE_ROOT, 'journals')

const resolveFishProvisioningAttemptId = (registration: VoiceRegistration): string | undefined => {
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

const loadPendingVoiceProvisioningAttempt = async (
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

const issuedProviderResource = (
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
  if (!title) throw UsageError('Fish provisioning journal has no safe reconciliation lookup handle; refuse to recreate the model.')
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

const searchGrokIssuedResource = async (
  attempt: VoiceProvisioningAttempt,
  registration: Pick<VoiceRegistration, 'provider' | 'provisioning'>,
  apiKey: string
): Promise<VoiceIssuedResource | undefined> => {
  const marker = attempt.reconciliation?.strategy === 'provider-search' ? attempt.reconciliation.providerHandle : undefined
  if (!marker) throw UsageError('Grok provisioning journal has no deterministic attempt marker; refuse to recreate the voice.')
  const provider = createGrokAdvancedProvider({ apiKey })
  if (!provider.catalog) throw UsageError('Grok voice catalog adapter is unavailable for reconciliation.')
  let cursor: string | undefined
  const matches = []
  for (let pageNumber = 0; pageNumber < 1000; pageNumber += 1) {
    const page = await provider.catalog.list({ source: 'account', ...(cursor ? { cursor } : {}) })
    matches.push(...page.entries.filter(entry => entry.description?.includes(marker)))
    if (!page.nextCursor) break
    cursor = page.nextCursor
    if (pageNumber === 999) throw UsageError('Grok reconciliation pagination exceeded its safety limit.')
  }
  if (matches.length > 1) throw UsageError('Grok reconciliation found multiple custom voices with the durable attempt marker.')
  const match = matches[0]
  if (!match) return undefined
  const checkedAt = new Date().toISOString()
  return {
    providerVoice: {
      kind: 'remote-resource', provider: 'grok', resourceId: match.resourceId, namespace: 'account',
      accountScopeHash: attempt.accountScopeHash,
      origin: registration.provisioning.state === 'ready' && registration.provisioning.providerVoice.kind === 'remote-resource'
        ? registration.provisioning.providerVoice.origin
        : 'instant-clone',
      ownership: 'project', deletion: { state: 'eligible', checkedAt },
    },
    observedAt: checkedAt,
    sanitizedResponseHash: hashCanonicalTtsValue({ provider: 'grok', voiceId: match.resourceId, marker }),
  }
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
  if (kind === 'ambiguous' && !input.allowAmbiguous) throw UsageError(AMBIGUOUS_VOICE_REDISPATCH_MESSAGE)
  const root = journalRootFor(input.journalRoot)
  let attempt = input.attempt
  if (attempt.outcome === undefined) attempt = await requireVoiceProvisioningReconciliation(root, attempt.registrationDraftId, attempt.attemptId)
  if (attempt.outcome?.state !== 'reconciliation-required') return attempt
  let issued = issuedProviderResource(attempt, input.registration)
  if (!issued) {
    if (input.registration.provider !== 'fish' && input.registration.provider !== 'grok') throw UsageError('Voice reconciliation is unavailable for this provider.')
    const provider = input.registration.provider
    const apiKey = resolveCredential(provider, 'require', { stage: `voice:${provider}`, providedValue: input.apiKey, useProvidedValue: true, description: `${provider === 'grok' ? 'Grok voice' : 'Fish model'} reconciliation` })
    if (providerAccountScopeHash(provider, apiKey) !== attempt.accountScopeHash) {
      throw UsageError(`${provider === 'grok' ? 'Grok' : 'Fish'} reconciliation credentials do not match the provisioning account scope.`)
    }
    issued = provider === 'grok'
      ? await searchGrokIssuedResource(attempt, input.registration, apiKey)
      : await searchFishIssuedResource(attempt, input.registration as VoiceRegistration, apiKey)
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
    outcome: { state: 'failed', code: 'reconciliation-not-found', message: `No ${input.registration.provider === 'grok' ? 'Grok custom voice' : 'Fish voice model'} matched the durable provisioning handle.` },
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
