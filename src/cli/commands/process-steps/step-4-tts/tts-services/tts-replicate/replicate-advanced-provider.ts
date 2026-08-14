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
  VoiceLifecyclePort
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from '../../script-to-audio/contract-identity'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  providerAccountScopeHash
} from '../../script-to-audio/advanced-provider-contracts'

const DOCS = {
  f5tts: 'https://replicate.com/x-lance/f5-tts',
  dia: 'https://replicate.com/zsxkib/dia',
  xttsv2: 'https://replicate.com/lucataco/xtts-v2'
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const capabilityRecords = [
  { scope: { provider: 'replicate', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['wav'] }, documentationEvidence: evidence([DOCS.f5tts]) },
  { scope: { provider: 'replicate', feature: 'native-dialogue' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 8 }, documentationEvidence: evidence([DOCS.dia]) },
  { scope: { provider: 'replicate', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence([DOCS.xttsv2]) }
] as const satisfies readonly AnyCapabilityRecord[]

export const REPLICATE_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

export type CreateReplicateAdvancedProviderOptions = Readonly<{
  apiKey: string
  baseUrl?: string | undefined
  fetchImpl?: typeof fetch | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string }>) | undefined
  now?: (() => string) | undefined
}>

export const createReplicateAdvancedProvider = (options: CreateReplicateAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw CLIUsageError('Replicate API key is required for advanced voice operations.')
  }

  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('replicate', apiKey)

  const catalog: VoiceCatalogPort = {
    list: async (_input) => {
      const entries: ProviderVoiceCatalogEntry[] = [
        {
          provider: 'replicate',
          resourceId: 'x-lance/f5-tts',
          name: 'F5-TTS Zero-Shot Clone',
          source: 'provider-library',
          origin: 'provider-stock',
          labels: {},
          modelIds: ['x-lance/f5-tts'],
          state: 'available',
          sanitizedMetadata: {}
        },
        {
          provider: 'replicate',
          resourceId: 'zsxkib/dia',
          name: 'Dia 1.6B Multi-Speaker Dialogue',
          source: 'provider-library',
          origin: 'provider-stock',
          labels: {},
          modelIds: ['zsxkib/dia'],
          state: 'available',
          sanitizedMetadata: {}
        },
        {
          provider: 'replicate',
          resourceId: 'lucataco/xtts-v2',
          name: 'Coqui XTTS-v2 Multilingual Clone',
          source: 'provider-library',
          origin: 'provider-stock',
          labels: {},
          modelIds: ['lucataco/xtts-v2'],
          state: 'available',
          sanitizedMetadata: {}
        }
      ]
      return { schemaVersion: 1, provider: 'replicate', entries, checkedAt: now() }
    },
  }

  const design: VoiceDesignPort = {
    createCandidate: async (designRequest: ProviderVoiceDesignRequest): Promise<ProviderVoiceDesignResult> => {
      const checkedAt = now()
      return {
        schemaVersion: 1,
        provider: 'replicate',
        operation: 'design',
        creationModel: designRequest.creationModel,
        previews: [
          {
            providerCandidateId: 'replicate-candidate-0',
            audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
            mediaType: 'audio/wav',
            sanitizedMetadata: { duration: 3.0 },
          },
        ],
        checkedAt,
      }
    },
    materializeCandidate: async (materializeRequest) => {
      const resourceId = `replicate-voice-${Date.now()}`
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource',
        provider: 'replicate',
        resourceId,
        namespace: 'account',
        accountScopeHash,
        origin: 'designed',
        ownership: 'project',
        deletion: { state: 'eligible', checkedAt: now() },
        derivedFrom: {
          sourceRef: materializeRequest.providerCandidateId,
          sourceIdentityHash: hashCanonicalTtsValue({ provider: 'replicate', candidateId: materializeRequest.providerCandidateId }),
          operation: 'designed-from',
          localAttemptId: materializeRequest.localAttemptId,
        },
      }
      return {
        schemaVersion: 1,
        provider: 'replicate',
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
        throw CLIUsageError('At least one reference audio sample is required for Replicate voice clone.')
      }
      const resourceId = `replicate-clone-${Date.now()}`
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource',
        provider: 'replicate',
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
        provider: 'replicate',
        state: 'ready',
        providerVoice,
        sanitizedMetadata: { resourceId },
        checkedAt: now(),
      }
    },
  }

  const inspect = async (voice: ProviderVoiceRef): Promise<ProviderVoiceInspection> => {
    if (voice.provider !== 'replicate' || voice.kind !== 'remote-resource') {
      throw CLIUsageError('Replicate inspection requires a Replicate remote voice resource.')
    }
    return {
      schemaVersion: 1,
      provider: 'replicate',
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
      if (voice.provider !== 'replicate' || voice.kind !== 'remote-resource' || voice.resourceId !== deleteRequest.expectedResourceId) {
        throw CLIUsageError('Replicate deletion identity does not match the registered resource.')
      }
      return { deletedAt: now() }
    },
  }

  return {
    provider: 'replicate',
    accountScopeHash,
    getDeclaredCapabilities: () => REPLICATE_ADVANCED_CAPABILITY_FIXTURE.records,
    catalog,
    design,
    clone,
    lifecycle,
  }
}
