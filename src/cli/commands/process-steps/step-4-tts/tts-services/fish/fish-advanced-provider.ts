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
import { FISH_API_BASE_URL, createFishClient } from '~/utils/fish-client/fish-client'
import { CLIUsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from '../../script-to-audio/contract-identity'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'

import { FISH_VOICE_DESIGN_MODEL } from './fish-tts-request'

const DOCS = {
  catalog: 'https://docs.fish.audio/api-reference/endpoint/model/list-models',
  inspect: 'https://docs.fish.audio/api-reference/endpoint/model/get-model',
  clone: 'https://docs.fish.audio/api-reference/endpoint/model/create-model',
  voiceDesign: 'https://docs.fish.audio/api-reference/endpoint/openapi-v1/voice-design',
  delete: 'https://docs.fish.audio/api-reference/endpoint/model/delete-model',
  synthesis: 'https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech',
  timestamps: 'https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-stream-with-timestamps',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const capabilityRecords = [
  { scope: { provider: 'fish', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['raw', 'wav', 'mp3', 'opus', 'flac'] }, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'fish', feature: 'native-dialogue' as const, model: 's2.1-pro' }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 16, maxCharacters: 4000 }, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'fish', feature: 'native-dialogue' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 2 }, reason: 'Fish native multi-speaker dialogue is documented only for s2.1-pro.', documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'fish', feature: 'word-timing' as const, model: 's2.1-pro' }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { providerTimeUnit: 'seconds', providerIndexUnit: 'unicode-scalar-value' as const }, documentationEvidence: evidence([DOCS.timestamps]) },
  { scope: { provider: 'fish', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence([DOCS.catalog, DOCS.inspect]) },
  { scope: { provider: 'fish', feature: 'voice-design' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: false }, documentationEvidence: evidence([DOCS.voiceDesign]) },
  { scope: { provider: 'fish', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.clone]) },
  { scope: { provider: 'fish', feature: 'voice-import' as const }, maturity: 'stable' as const, channel: 'external-import' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: false }, documentationEvidence: evidence([DOCS.catalog, DOCS.inspect]) },
  { scope: { provider: 'fish', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.delete]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const FISH_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

export type CreateFishAdvancedProviderOptions = Readonly<{
  apiKey: string
  baseUrl?: string | undefined
  fetchImpl?: typeof fetch | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string }>) | undefined
  now?: (() => string) | undefined
}>

export const createFishAdvancedProvider = (options: CreateFishAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw CLIUsageError('Fish Audio API key is required for advanced voice operations.')
  }

  const client = createFishClient({
    apiKey,
    baseUrl: options.baseUrl ?? FISH_API_BASE_URL,
    fetchImpl: options.fetchImpl,
  })

  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('fish', apiKey)

  const catalog: VoiceCatalogPort = {
    list: async (input) => {
      const pageNumber = input?.cursor ? Number.parseInt(input.cursor, 10) : 1
      const pageSize = 20
      const source = input?.source === 'provider-library' ? 'provider-library' : 'account'
      const response = await client.listModels({ page_number: pageNumber, page_size: pageSize, self: source === 'account' })
      const entries: ProviderVoiceCatalogEntry[] = response.items.map((item) => ({
        provider: 'fish',
        resourceId: item._id,
        name: item.title,
        source,
        origin: source === 'account' ? 'imported-custom' : 'provider-stock',
        ...(item.description ? { description: item.description } : {}),
        labels: {},
        modelIds: [],
        state: item.state === 'trained' || item.state === 'ready' || !item.state ? 'available' : 'unavailable',
        sanitizedMetadata: { state: item.state ?? 'trained' },
      }))
      const nextCursor = response.items.length >= pageSize ? String(pageNumber + 1) : undefined
      return { schemaVersion: 1, provider: 'fish', entries, ...(nextCursor ? { nextCursor } : {}), checkedAt: now() }
    },
  }

  const design: VoiceDesignPort = {
    createCandidate: async (designRequest: ProviderVoiceDesignRequest): Promise<ProviderVoiceDesignResult> => {
      if (designRequest.creationModel !== FISH_VOICE_DESIGN_MODEL) {
        throw CLIUsageError('Fish Audio Voice Design creation model must be voice-design-1.')
      }
      if (!Number.isInteger(designRequest.candidateCount) || designRequest.candidateCount < 1 || designRequest.candidateCount > 4) {
        throw CLIUsageError('Fish Audio Voice Design supports one to four bounded previews per request.')
      }
      const res = await client.voiceDesign({
        instruction: designRequest.description,
        ...(designRequest.previewText.trim() ? { reference_text: designRequest.previewText } : {}),
        n: designRequest.candidateCount,
        ...(typeof designRequest.seed === 'number' ? { seed: designRequest.seed } : {}),
      })
      const checkedAt = now()
      return {
        schemaVersion: 1,
        provider: 'fish',
        operation: 'design',
        creationModel: designRequest.creationModel,
        previews: res.candidates.slice(0, designRequest.candidateCount).map((candidate) => ({
          providerCandidateId: candidate.id,
          audioBase64: candidate.audio_base64,
          mediaType: 'audio/wav',
          durationMs: candidate.duration_ms,
          sanitizedMetadata: {
            candidateIndex: candidate.index,
            sampleRate: candidate.sample_rate,
            durationMs: candidate.duration_ms,
            ...(typeof designRequest.seed === 'number' ? { seed: designRequest.seed } : {}),
            ...(candidate.language ? { language: candidate.language } : {}),
          },
        })),
        checkedAt,
      }
    },
    materializeCandidate: async (materializeRequest) => {
      if (!materializeRequest.protectedPreview) {
        throw CLIUsageError('Fish Audio candidate materialization requires its protected preview audio.')
      }
      if (!options.resolveProtectedAsset) {
        throw CLIUsageError('Fish Audio candidate materialization requires a protected-asset resolver.')
      }
      const preview = await options.resolveProtectedAsset(materializeRequest.protectedPreview)
      if (preview.bytes.byteLength === 0) {
        throw CLIUsageError('Fish Audio candidate preview audio is empty.')
      }
      const model = await client.createModel({
        title: materializeRequest.desiredName,
        voices: [preview.bytes],
      })
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource',
        provider: 'fish',
        resourceId: model._id,
        namespace: 'account',
        accountScopeHash,
        origin: 'designed',
        ownership: 'project',
        deletion: { state: 'eligible', checkedAt: now() },
        derivedFrom: {
          sourceRef: materializeRequest.protectedPreview.assetId,
          sourceIdentityHash: materializeRequest.protectedPreview.sha256,
          operation: 'designed-from',
          localAttemptId: materializeRequest.localAttemptId,
        },
      }
      return {
        schemaVersion: 1,
        provider: 'fish',
        state: 'ready',
        providerVoice,
        sanitizedMetadata: {
          modelId: model._id,
          candidateIdentityHash: hashCanonicalTtsValue({ provider: 'fish', candidateId: materializeRequest.providerCandidateId })
        },
        checkedAt: now(),
      }
    },
  }

  const clone: VoiceClonePort = {
    clone: async (cloneRequest) => {
      if (cloneRequest.cloneKind === 'professional') {
        throw CLIUsageError('Fish Audio does not document a professional voice-clone workflow.')
      }
      if (!cloneRequest.protectedSamples || cloneRequest.protectedSamples.length === 0) {
        throw CLIUsageError('At least one reference audio sample is required for Fish Audio voice clone.')
      }
      if (!options.resolveProtectedAsset) {
        throw CLIUsageError('Fish Audio cloning requires a protected-asset resolver.')
      }
      const samples = await Promise.all(
        cloneRequest.protectedSamples.map(async (s) => (await options.resolveProtectedAsset!(s)).bytes)
      )
      const model = await client.createModel({
        title: cloneRequest.desiredName,
        ...(cloneRequest.description ? { description: cloneRequest.description } : {}),
        voices: samples,
      })
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource',
        provider: 'fish',
        resourceId: model._id,
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
        provider: 'fish',
        state: 'ready',
        providerVoice,
        sanitizedMetadata: { modelId: model._id },
        checkedAt: now(),
      }
    },
  }

  const inspect = async (voice: ProviderVoiceRef): Promise<ProviderVoiceInspection> => {
    if (voice.provider !== 'fish' || voice.kind !== 'remote-resource') {
      throw CLIUsageError('Fish inspection requires a Fish remote voice resource.')
    }
    const item = await client.getModel(voice.resourceId)
    return {
      schemaVersion: 1,
      provider: 'fish',
      providerVoice: voice,
      state: item.state === 'ready' || !item.state ? 'available' : 'missing',
      deletion: voice.deletion,
      sanitizedMetadata: {
        ...(item.description ? { description: item.description } : {}),
        ...(item.created_at ? { createdAt: item.created_at } : {}),
      },
      checkedAt: now(),
    }
  }

  const lifecycle: VoiceLifecyclePort = {
    inspect,
    delete: async (deleteRequest) => {
      const voice = deleteRequest.providerVoice
      if (voice.provider !== 'fish' || voice.kind !== 'remote-resource' || voice.resourceId !== deleteRequest.expectedResourceId) {
        throw CLIUsageError('Fish deletion identity does not match the registered resource.')
      }
      await client.deleteModel(voice.resourceId)
      return { deletedAt: now() }
    },
  }

  return {
    provider: 'fish',
    accountScopeHash,
    getDeclaredCapabilities: () => FISH_ADVANCED_CAPABILITY_FIXTURE.records,
    catalog,
    design,
    clone,
    lifecycle,
  }
}
