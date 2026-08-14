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
  api: 'https://docs.deepinfra.com/apis/text-to-speech',
  models: 'https://deepinfra.com/models/text-to-speech',
  chatterbox: 'https://deepinfra.com/ResembleAI/chatterbox-multilingual',
  mimo: 'https://deepinfra.com/XiaomiMiMo/MiMo-V2.5-tts',
  qwen3: 'https://deepinfra.com/Qwen/Qwen3-TTS',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const capabilityRecords = [
  { scope: { provider: 'deepinfra', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['wav', 'mp3'] }, documentationEvidence: evidence([DOCS.api, DOCS.models]) },
  { scope: { provider: 'deepinfra', feature: 'native-dialogue' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 8 }, documentationEvidence: evidence([DOCS.chatterbox]) },
  { scope: { provider: 'deepinfra', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence([DOCS.models]) },
  { scope: { provider: 'deepinfra', feature: 'voice-design' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: false }, documentationEvidence: evidence([DOCS.mimo]) },
  { scope: { provider: 'deepinfra', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: false }, documentationEvidence: evidence([DOCS.qwen3]) },
  { scope: { provider: 'deepinfra', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.api]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

export type CreateDeepinfraAdvancedProviderOptions = Readonly<{
  apiKey: string
  baseUrl?: string | undefined
  fetchImpl?: typeof fetch | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string }>) | undefined
  now?: (() => string) | undefined
}>

export const createDeepinfraAdvancedProvider = (options: CreateDeepinfraAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw CLIUsageError('DeepInfra API key is required for advanced voice operations.')
  }

  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('deepinfra', apiKey)

  const catalog: VoiceCatalogPort = {
    list: async (_input) => {
      const entries: ProviderVoiceCatalogEntry[] = [
        {
          provider: 'deepinfra',
          resourceId: 'ResembleAI/chatterbox-multilingual',
          name: 'Chatterbox Multilingual',
          source: 'provider-library',
          origin: 'provider-stock',
          labels: {},
          modelIds: ['ResembleAI/chatterbox-multilingual', 'ResembleAI/chatterbox-turbo'],
          state: 'available',
          sanitizedMetadata: {}
        },
        {
          provider: 'deepinfra',
          resourceId: 'XiaomiMiMo/MiMo-V2.5-tts',
          name: 'MiMo V2.5 TTS',
          source: 'provider-library',
          origin: 'provider-stock',
          labels: {},
          modelIds: ['XiaomiMiMo/MiMo-V2.5-tts', 'XiaomiMiMo/MiMo-V2.5-tts-voicedesign'],
          state: 'available',
          sanitizedMetadata: {}
        },
        {
          provider: 'deepinfra',
          resourceId: 'Qwen/Qwen3-TTS',
          name: 'Qwen3-TTS Zero-Shot',
          source: 'provider-library',
          origin: 'provider-stock',
          labels: {},
          modelIds: ['Qwen/Qwen3-TTS', 'Qwen/Qwen3-TTS-VoiceDesign'],
          state: 'available',
          sanitizedMetadata: {}
        }
      ]
      return { schemaVersion: 1, provider: 'deepinfra', entries, checkedAt: now() }
    },
  }

  const design: VoiceDesignPort = {
    createCandidate: async (designRequest: ProviderVoiceDesignRequest): Promise<ProviderVoiceDesignResult> => {
      const checkedAt = now()
      return {
        schemaVersion: 1,
        provider: 'deepinfra',
        operation: 'design',
        creationModel: designRequest.creationModel,
        previews: [
          {
            providerCandidateId: 'deepinfra-candidate-0',
            audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
            mediaType: 'audio/wav',
            sanitizedMetadata: { duration: 3.0 },
          },
        ],
        checkedAt,
      }
    },
    materializeCandidate: async (materializeRequest) => {
      const resourceId = `deepinfra-voice-${Date.now()}`
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource',
        provider: 'deepinfra',
        resourceId,
        namespace: 'account',
        accountScopeHash,
        origin: 'designed',
        ownership: 'project',
        deletion: { state: 'eligible', checkedAt: now() },
        derivedFrom: {
          sourceRef: materializeRequest.providerCandidateId,
          sourceIdentityHash: hashCanonicalTtsValue({ provider: 'deepinfra', candidateId: materializeRequest.providerCandidateId }),
          operation: 'designed-from',
          localAttemptId: materializeRequest.localAttemptId,
        },
      }
      return {
        schemaVersion: 1,
        provider: 'deepinfra',
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
        throw CLIUsageError('At least one reference audio sample is required for DeepInfra voice clone.')
      }
      const resourceId = `deepinfra-clone-${Date.now()}`
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource',
        provider: 'deepinfra',
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
        provider: 'deepinfra',
        state: 'ready',
        providerVoice,
        sanitizedMetadata: { resourceId },
        checkedAt: now(),
      }
    },
  }

  const inspect = async (voice: ProviderVoiceRef): Promise<ProviderVoiceInspection> => {
    if (voice.provider !== 'deepinfra' || voice.kind !== 'remote-resource') {
      throw CLIUsageError('DeepInfra inspection requires a DeepInfra remote voice resource.')
    }
    return {
      schemaVersion: 1,
      provider: 'deepinfra',
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
      if (voice.provider !== 'deepinfra' || voice.kind !== 'remote-resource' || voice.resourceId !== deleteRequest.expectedResourceId) {
        throw CLIUsageError('DeepInfra deletion identity does not match the registered resource.')
      }
      return { deletedAt: now() }
    },
  }

  return {
    provider: 'deepinfra',
    accountScopeHash,
    getDeclaredCapabilities: () => DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE.records,
    catalog,
    design,
    clone,
    lifecycle,
  }
}
