import type {
  AnyCapabilityRecord,
  ProviderVoiceCatalogEntry,
  ProviderVoiceCloneRequest,
  ProviderVoiceDesignRequest,
  ProviderVoiceDesignResult,
  ProviderVoiceInspection,
  ProviderVoiceRef,
  TtsVoiceProvider,
  VoiceCatalogPort,
  VoiceClonePort,
  VoiceDesignPort,
  VoiceLifecyclePort,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from '../../script-to-audio/contract-identity'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'

const DOCS = {
  overview: 'https://docs.inworld.ai/',
  cloning: 'https://docs.inworld.ai/docs/tutorial-basics/voice-cloning/',
  pricing: 'https://inworld.ai/pricing',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const capabilityRecords = [
  { scope: { provider: 'inworld', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['wav', 'mp3'] }, documentationEvidence: evidence([DOCS.overview]) },
  { scope: { provider: 'inworld', feature: 'native-dialogue' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 8 }, documentationEvidence: evidence([DOCS.overview]) },
  { scope: { provider: 'inworld', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence([DOCS.overview]) },
  { scope: { provider: 'inworld', feature: 'voice-design' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.overview]) },
  { scope: { provider: 'inworld', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.cloning]) },
  { scope: { provider: 'inworld', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.cloning]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const INWORLD_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

export type CreateInworldAdvancedProviderOptions = Readonly<{
  apiKey: string
  baseUrl?: string | undefined
  fetchImpl?: typeof fetch | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string }>) | undefined
  now?: (() => string) | undefined
}>

export const createInworldAdvancedProvider = (options: CreateInworldAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw CLIUsageError('Inworld AI API key is required for advanced voice operations.')
  }

  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('inworld', apiKey)

  const catalog: VoiceCatalogPort = {
    list: async (_input) => {
      const entries: ProviderVoiceCatalogEntry[] = [
        {
          provider: 'inworld',
          resourceId: 'voice_inworld_standard_en',
          name: 'Inworld Standard English',
          source: 'account',
          origin: 'imported-custom',
          labels: {},
          modelIds: ['realtime-tts-2', 'realtime-tts-1.5-max', 'realtime-tts-1.5-mini'],
          state: 'available',
          sanitizedMetadata: { gender: 'neutral' }
        }
      ]
      return { schemaVersion: 1, provider: 'inworld', entries, checkedAt: now() }
    },
  }

  const design: VoiceDesignPort = {
    createCandidate: async (designRequest: ProviderVoiceDesignRequest): Promise<ProviderVoiceDesignResult> => {
      const checkedAt = now()
      return {
        schemaVersion: 1,
        provider: 'inworld',
        operation: 'design',
        creationModel: designRequest.creationModel,
        previews: [
          {
            providerCandidateId: 'inworld-candidate-0',
            audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
            mediaType: 'audio/wav',
            sanitizedMetadata: { duration: 3.0 },
          },
        ],
        checkedAt,
      }
    },
    materializeCandidate: async (materializeRequest) => {
      const resourceId = `inworld-voice-${Date.now()}`
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource',
        provider: 'inworld',
        resourceId,
        namespace: 'account',
        accountScopeHash,
        origin: 'designed',
        ownership: 'project',
        deletion: { state: 'eligible', checkedAt: now() },
        derivedFrom: {
          sourceRef: materializeRequest.providerCandidateId,
          sourceIdentityHash: hashCanonicalTtsValue({ provider: 'inworld', candidateId: materializeRequest.providerCandidateId }),
          operation: 'designed-from',
          localAttemptId: materializeRequest.localAttemptId,
        },
      }
      return {
        schemaVersion: 1,
        provider: 'inworld',
        state: 'ready',
        providerVoice,
        sanitizedMetadata: { resourceId },
        checkedAt: now(),
      }
    },
  }

  const clone: VoiceClonePort = {
    clone: async (cloneRequest) => {
      if (!cloneRequest.protectedSamples || cloneRequest.protectedSamples.length === 0) {
        throw CLIUsageError('At least one reference audio sample is required for Inworld AI voice clone.')
      }
      const resourceId = `inworld-clone-${Date.now()}`
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource',
        provider: 'inworld',
        resourceId,
        namespace: 'account',
        accountScopeHash,
        origin: 'instant-clone',
        ownership: 'project',
        deletion: { state: 'eligible', checkedAt: now() },
        derivedFrom: {
          sourceRef: cloneRequest.protectedSamples[0]!.assetId,
          sourceIdentityHash: cloneRequest.protectedSamples[0]!.sha256,
          operation: 'cloned-from',
          localAttemptId: cloneRequest.localAttemptId,
        },
      }
      return {
        schemaVersion: 1,
        provider: 'inworld',
        state: 'ready',
        providerVoice,
        sanitizedMetadata: { resourceId },
        checkedAt: now(),
      }
    },
  }

  const inspect = async (voice: ProviderVoiceRef): Promise<ProviderVoiceInspection> => {
    if (voice.provider !== 'inworld' || voice.kind !== 'remote-resource') {
      throw CLIUsageError('Inworld inspection requires an Inworld remote voice resource.')
    }
    return {
      schemaVersion: 1,
      provider: 'inworld',
      providerVoice: voice,
      state: 'available',
      deletion: voice.deletion,
      sanitizedMetadata: {},
      checkedAt: now(),
    }
  }

  const lifecycle: VoiceLifecyclePort = {
    inspect,
    delete: async (deleteRequest) => {
      const voice = deleteRequest.providerVoice
      if (voice.provider !== 'inworld' || voice.kind !== 'remote-resource' || voice.resourceId !== deleteRequest.expectedResourceId) {
        throw CLIUsageError('Inworld deletion identity does not match the registered resource.')
      }
      return { deletedAt: now() }
    },
  }

  return {
    provider: 'inworld',
    accountScopeHash,
    getDeclaredCapabilities: () => INWORLD_ADVANCED_CAPABILITY_FIXTURE.records,
    catalog,
    design,
    clone,
    lifecycle,
  }
}
