import type {
  ProviderVoiceInspection,
  ProviderVoiceRef,
  SanitizedProviderVoiceMetadata,
  TtsProvider,
  VoiceLifecyclePort
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

/**
 * Identity used in the shared safety messages. `labelWithArticle` exists because the
 * provider names take different articles ("a Cartesia" vs "an Inworld") and these
 * strings are asserted verbatim by the management contract tests.
 */
export type AdvancedVoiceProviderIdentity = {
  provider: TtsProvider
  label: string
  labelWithArticle: string
  accountScopeHash: string
}

/**
 * How one provider spells its deletion eligibility rule. `namespaceCheck` decides which
 * guard a non-account namespace trips: most providers treat it as an ownership failure,
 * ElevenLabs reports it as an account-scope mismatch.
 */
export type AdvancedVoiceDeletionPolicy = {
  /** Completes "… deletes only eligibility-checked project-owned <ownedResourceLabel>." */
  ownedResourceLabel: string
  namespaceCheck?: 'ownership' | 'account-scope' | undefined
}

export type RemoteVoiceResourceRef = Extract<ProviderVoiceRef, { kind: 'remote-resource' }>

export const assertAdvancedVoiceInspectionIdentity = (
  identity: AdvancedVoiceProviderIdentity,
  voice: ProviderVoiceRef
): RemoteVoiceResourceRef => {
  if (voice.provider !== identity.provider || voice.kind !== 'remote-resource') {
    throw CLIUsageError(`${identity.label} inspection requires ${identity.labelWithArticle} remote voice resource.`)
  }
  return voice
}

/**
 * The account-scope and ownership barrier every managed deletion must clear: the request
 * names the resource we registered, the resource is a project-owned account voice that
 * has been eligibility-checked, and the caller's credentials belong to the same account.
 */
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

/**
 * The lifecycle shape shared by providers that read one voice by resource ID and delete
 * it with a single request. Providers whose deletion needs extra proof (Hume's unique
 * name check) or whose response must be re-verified (MiniMax) keep their own port and
 * call the guards above directly.
 */
export const createRemoteResourceVoiceLifecycle = (
  identity: AdvancedVoiceProviderIdentity,
  policy: AdvancedVoiceDeletionPolicy,
  operations: {
    /** Fetches and maps the provider's current view of one registered voice. */
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

/**
 * No sample may leave the machine before consent and provenance are on record. Providers
 * supply only the trailing clause because each names the external action it is about to
 * take ("before any external upload" versus "before any provider action").
 */
export const assertAdvancedVoiceCloneAuthorized = (
  identity: AdvancedVoiceProviderIdentity,
  cloneRequest: { consentRecordRef?: string | undefined, provenanceRef?: string | undefined },
  beforeClause: string
): void => {
  if (!cloneRequest.consentRecordRef || !cloneRequest.provenanceRef) {
    throw CLIUsageError(`${identity.label} cloning requires consent and provenance ${beforeClause}.`)
  }
}

/** The account-scoped, project-owned voice reference a completed clone produces. */
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
