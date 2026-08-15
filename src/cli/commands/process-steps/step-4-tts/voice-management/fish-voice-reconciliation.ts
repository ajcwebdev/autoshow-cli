import { join } from 'node:path'
import type { VoiceIssuedResource, VoiceRegistration } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { createFishClient } from '~/utils/fish-client/fish-client'
import { hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { providerAccountScopeHash } from '../script-to-audio/advanced-provider-contracts'
import { recordVoiceProvisioningOutcome } from './character-voice-registry'
import { loadVoiceProvisioningAttempt, reconcileVoiceProvisioningAttempt, requireVoiceProvisioningReconciliation } from './provisioning-journal'
import { MANAGED_VOICE_STORE_ROOT } from './managed-voice-store'

export const reconcileFishModelRegistration = async (input: {
  charactersRoot: string
  registration: VoiceRegistration
  apiKey: string
  journalRoot?: string | undefined
}): Promise<VoiceRegistration> => {
  const registration = input.registration
  if (registration.provider !== 'fish') throw CLIUsageError('Only Fish model-creation reconciliation is implemented for this provider path.')
  const attemptId = typeof registration.sanitizedProviderMetadata['attemptId'] === 'string'
    ? registration.sanitizedProviderMetadata['attemptId']
    : registration.provisioning.state === 'pending'
      ? registration.provisioning.operationId
      : typeof registration.sanitizedProviderMetadata['provisioningAttemptId'] === 'string'
        ? registration.sanitizedProviderMetadata['provisioningAttemptId']
        : undefined
  if (!attemptId) throw CLIUsageError('Fish registration does not identify its provisioning attempt.')
  const journalRoot = input.journalRoot ?? join(MANAGED_VOICE_STORE_ROOT, 'journals')
  let attempt = await loadVoiceProvisioningAttempt(journalRoot, registration.registrationId, attemptId)
  if (providerAccountScopeHash('fish', input.apiKey) !== attempt.accountScopeHash) {
    throw CLIUsageError('Fish reconciliation credentials do not match the provisioning account scope.')
  }
  if (attempt.outcome === undefined) attempt = await requireVoiceProvisioningReconciliation(journalRoot, registration.registrationId, attemptId)
  if (attempt.outcome?.state === 'reconciliation-required') {
    let issued = attempt.issuedResources.find(resource => resource.providerVoice.provider === 'fish')
    if (!issued) {
      const title = attempt.reconciliation?.strategy === 'provider-search'
        ? attempt.reconciliation.providerHandle
        : typeof registration.sanitizedProviderMetadata['desiredName'] === 'string'
          ? registration.sanitizedProviderMetadata['desiredName']
          : undefined
      if (!title) throw CLIUsageError('Fish provisioning journal has no safe reconciliation lookup handle; refuse to recreate the model.')
      const client = createFishClient({ apiKey: input.apiKey })
      const catalog = await client.listModels({ self: true, title, page_size: 20, page_number: 1 })
      const match = catalog.items.find(item => item.title === title)
      if (match) {
        const checkedAt = new Date().toISOString()
        issued = {
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
    }
    if (issued) {
      attempt = await reconcileVoiceProvisioningAttempt({
        journalRoot,
        registrationDraftId: registration.registrationId,
        attemptId,
        outcome: { state: 'ready', providerVoice: issued.providerVoice },
        issuedResources: [issued],
        evidenceHash: issued.sanitizedResponseHash,
      })
    } else {
      const evidenceHash = hashCanonicalTtsValue({ provider: 'fish', attemptId, result: 'not-found' })
      attempt = await reconcileVoiceProvisioningAttempt({
        journalRoot,
        registrationDraftId: registration.registrationId,
        attemptId,
        outcome: { state: 'failed', code: 'reconciliation-not-found', message: 'No Fish voice model matched the durable provisioning handle.' },
        evidenceHash,
      })
    }
  }
  if (!attempt.outcome) throw CLIUsageError('Fish reconciliation did not produce a durable outcome.')
  return await recordVoiceProvisioningOutcome({
    charactersRoot: input.charactersRoot,
    registrationId: registration.registrationId,
    generationId: registration.generationId,
    provisioning: attempt.outcome,
    sanitizedProviderMetadata: { attemptId, reconciliationState: attempt.outcome.state },
  })
}
