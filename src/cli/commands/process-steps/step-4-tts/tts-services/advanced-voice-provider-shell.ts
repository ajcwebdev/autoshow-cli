import type {
  AdvancedVoiceDeletionPolicy,
  AdvancedVoiceProviderIdentity,
  ProviderVoiceInspection,
  ProviderVoiceRef,
  RemoteVoiceResourceRef,
  SanitizedProviderVoiceMetadata,
  VoiceLifecyclePort
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const assertAdvancedVoiceInspectionIdentity = (
  identity: AdvancedVoiceProviderIdentity,
  voice: ProviderVoiceRef
): RemoteVoiceResourceRef => {
  if (voice.provider !== identity.provider || voice.kind !== 'remote-resource') {
    throw CLIUsageError(`${identity.label} inspection requires ${identity.labelWithArticle} remote voice resource.`)
  }
  return voice
}

export const assertAdvancedVoiceDeletable = (
  identity: AdvancedVoiceProviderIdentity,
  policy: AdvancedVoiceDeletionPolicy,
  deleteRequest: { providerVoice: ProviderVoiceRef, expectedResourceId: string }
): RemoteVoiceResourceRef => {
  const voice = deleteRequest.providerVoice
  if (voice.provider !== identity.provider || voice.kind !== 'remote-resource' || voice.resourceId !== deleteRequest.expectedResourceId) {
    throw CLIUsageError(`${identity.label} deletion identity does not match the registered resource.`)
  }

  const namespaceWithOwnership = (policy.namespaceCheck ?? 'ownership') === 'ownership'
  if (
    voice.ownership !== 'project'
    || voice.deletion.state !== 'eligible'
    || (namespaceWithOwnership && voice.namespace !== 'account')
  ) {
    throw CLIUsageError(`${identity.label} deletes only eligibility-checked project-owned ${policy.ownedResourceLabel}.`)
  }

  if ((!namespaceWithOwnership && voice.namespace !== 'account') || voice.accountScopeHash !== identity.accountScopeHash) {
    throw CLIUsageError(`${identity.label} deletion credentials do not match the registered account scope.`)
  }

  return voice
}

export const buildAdvancedVoiceInspection = (
  identity: AdvancedVoiceProviderIdentity,
  input: {
    voice: RemoteVoiceResourceRef
    state: ProviderVoiceInspection['state']
    sanitizedMetadata: SanitizedProviderVoiceMetadata
    checkedAt: string
  }
): ProviderVoiceInspection => ({
  schemaVersion: 1,
  provider: identity.provider,
  providerVoice: input.voice,
  state: input.state,
  deletion: input.voice.deletion,
  sanitizedMetadata: input.sanitizedMetadata,
  checkedAt: input.checkedAt
})

export const createRemoteResourceVoiceLifecycle = (
  identity: AdvancedVoiceProviderIdentity,
  policy: AdvancedVoiceDeletionPolicy,
  operations: {
    fetchVoice: (voice: RemoteVoiceResourceRef) => Promise<{
      state: ProviderVoiceInspection['state']
      sanitizedMetadata: SanitizedProviderVoiceMetadata
    }>
    deleteVoice: (voice: RemoteVoiceResourceRef) => Promise<void>
    now: () => string
  }
): VoiceLifecyclePort => ({
  inspect: async (voice) => {
    const remote = assertAdvancedVoiceInspectionIdentity(identity, voice)
    const observed = await operations.fetchVoice(remote)
    return buildAdvancedVoiceInspection(identity, {
      voice: remote,
      state: observed.state,
      sanitizedMetadata: observed.sanitizedMetadata,
      checkedAt: operations.now()
    })
  },
  delete: async (deleteRequest) => {
    await operations.deleteVoice(assertAdvancedVoiceDeletable(identity, policy, deleteRequest))
    return { deletedAt: operations.now() }
  }
})

export const assertAdvancedVoiceCloneAuthorized = (
  identity: AdvancedVoiceProviderIdentity,
  cloneRequest: { consentRecordRef?: string | undefined, provenanceRef?: string | undefined },
  beforeClause: string
): void => {
  if (!cloneRequest.consentRecordRef || !cloneRequest.provenanceRef) {
    throw CLIUsageError(`${identity.label} cloning requires consent and provenance ${beforeClause}.`)
  }
}

export const buildClonedProviderVoiceRef = (
  identity: AdvancedVoiceProviderIdentity,
  input: {
    resourceId: string
    sample: { assetId: string, sha256: string }
    localAttemptId: string
    checkedAt: string
  }
): RemoteVoiceResourceRef => ({
  kind: 'remote-resource',
  provider: identity.provider,
  resourceId: input.resourceId,
  namespace: 'account',
  accountScopeHash: identity.accountScopeHash,
  origin: 'instant-clone',
  ownership: 'project',
  deletion: { state: 'eligible', checkedAt: input.checkedAt },
  derivedFrom: {
    sourceRef: input.sample.assetId,
    sourceIdentityHash: input.sample.sha256,
    operation: 'cloned-from',
    localAttemptId: input.localAttemptId
  }
})
