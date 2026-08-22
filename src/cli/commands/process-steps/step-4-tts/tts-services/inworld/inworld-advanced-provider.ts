import type { AnyCapabilityRecord, CreateInworldAdvancedProviderOptions, ProviderVoiceCatalogEntry, ProviderVoiceCatalogPage, ProviderVoiceDesignResult, ProviderVoiceMutationResult, ProviderVoiceRef, TtsVoiceProvider, VoiceCatalogPort, VoiceClonePort, VoiceDesignPort } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from '../../script-to-audio/contract-identity'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  createAdvancedProviderJsonRequest,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'
import { createProviderRecordReader, trimmedString } from '../advanced-provider-json'
import type { AdvancedVoiceProviderIdentity } from '~/types'
import { assertAdvancedVoiceCloneAuthorized, createRemoteResourceVoiceLifecycle } from '../advanced-voice-provider-shell'
import { requireProvidedApiKey } from '~/utils/validate/env-utils'

const DOCS = {
  synthesis: 'https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech',
  catalog: 'https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/list-voices',
  inspect: 'https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/get-voice',
  design: 'https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/design-voice',
  publish: 'https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/publish-voice',
  clone: 'https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/clone-voice',
  professionalClone: 'https://docs.inworld.ai/tts/professional-voice-cloning',
  delete: 'https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/delete-voice',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const capabilityRecords = [
  { scope: { provider: 'inworld', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['wav'] }, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'inworld', feature: 'native-dialogue' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 2 }, reason: 'The adapter sends one voiceId per synthesis request and does not implement a native multi-speaker request.', documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'inworld', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: false, stableResourceIds: true }, documentationEvidence: evidence([DOCS.catalog, DOCS.inspect]) },
  { scope: { provider: 'inworld', feature: 'voice-design' as const }, maturity: 'preview' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.design, DOCS.publish]) },
  { scope: { provider: 'inworld', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.clone]) },
  { scope: { provider: 'inworld', feature: 'professional-clone' as const }, maturity: 'preview' as const, channel: 'ui-only' as const, adapterSupport: 'planned' as const, requirements: [{ kind: 'approval' as const, approvalKind: 'professional-voice-clone' }], constraints: { requiresConsent: true, createsRemoteResource: true }, reason: 'Inworld Professional Voice Cloning is a beta Portal workflow and is not supported by the Voice Cloning API.', documentationEvidence: evidence([DOCS.professionalClone]) },
  { scope: { provider: 'inworld', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.delete]) },
  { scope: { provider: 'inworld', feature: 'word-timing' as const, transport: 'hosted-api' }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { providerTimeUnit: 'seconds' }, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'inworld', feature: 'phoneme-timing' as const, transport: 'hosted-api' }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { providerTimeUnit: 'seconds' }, documentationEvidence: evidence([DOCS.synthesis]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const INWORLD_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

const record = createProviderRecordReader('Inworld')

export const mapInworldVoice = (value: unknown): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = trimmedString(voice['voiceId'])
  const name = trimmedString(voice['displayName']) ?? trimmedString(voice['name'])
  if (!resourceId || !name) throw CLIUsageError('Inworld voice response omits voiceId or displayName.')
  const source = trimmedString(voice['source'])
  const providerStock = source === 'SYSTEM'
  const origin = providerStock ? 'provider-stock' as const : source === 'PVC' ? 'professional-clone' as const : 'imported-custom' as const
  const tags = Array.isArray(voice['tags']) ? voice['tags'].filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0) : []
  const labels = Object.fromEntries([
    ['language', trimmedString(voice['langCode'])],
    ['gender', trimmedString(voice['gender'])],
    ['ageGroup', trimmedString(voice['ageGroup'])],
  ].flatMap(([key, item]) => item ? [[key as string, item]] : []))
  return {
    provider: 'inworld',
    resourceId,
    name,
    source: providerStock ? 'provider-library' : 'account',
    origin,
    ...(trimmedString(voice['description']) ? { description: trimmedString(voice['description']) } : {}),
    labels: { ...labels, ...(tags.length > 0 ? { tags: tags.join(',') } : {}) },
    modelIds: ['realtime-tts-2'],
    state: 'available',
    sanitizedMetadata: {
      source: source ?? 'UNKNOWN',
      ...(trimmedString(voice['name']) ? { resourceName: trimmedString(voice['name']) as string } : {}),
      ...(trimmedString(voice['languageCode']) ? { languageCode: trimmedString(voice['languageCode']) as string } : {}),
      ...(Array.isArray(voice['categories']) ? { categories: voice['categories'].filter((item): item is string => typeof item === 'string') } : {}),
      ...(Array.isArray(voice['promptLanguages']) ? { promptLanguages: voice['promptLanguages'].filter((item): item is string => typeof item === 'string') } : {})
    }
  }
}

export const createInworldAdvancedProvider = (
  options: CreateInworldAdvancedProviderOptions
): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const apiKey = requireProvidedApiKey(options.apiKey, 'INWORLD_API_KEY', 'voice:inworld', 'Inworld capability inspection')
  const request = options.request ?? createAdvancedProviderJsonRequest({
    baseUrl: 'https://api.inworld.ai',
    apiKey: apiKey.startsWith('Basic ') ? apiKey : `Basic ${apiKey}`,
    apiKeyHeader: 'Authorization',
    providerLabel: 'Inworld'
  })
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('inworld', apiKey)
  const catalog: VoiceCatalogPort = {
    list: async input => {
      if (input?.cursor) throw CLIUsageError('Inworld voice catalog is not paginated.')
      const requestedSource = input?.source
      const payload = record(await request({ method: 'GET', path: '/voices/v1/voices', query: { languages: 'EN_US' } }), 'voice catalog')
      const entries = (Array.isArray(payload['voices']) ? payload['voices'].map(mapInworldVoice) : [])
        .filter(entry => requestedSource === undefined || requestedSource === entry.source || (requestedSource === 'provider-library' && entry.source === 'provider-library'))
      const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'inworld', entries, checkedAt: now() }
      return page
    }
  }

  const design: VoiceDesignPort = {
    createCandidate: async designRequest => {
      if (designRequest.sourceVoice) throw CLIUsageError('Inworld Voice Design does not expose a voice remix operation.')
      if (designRequest.seed !== undefined) throw CLIUsageError('Inworld Voice Design does not expose a deterministic seed.')
      const designPrompt = designRequest.description.trim()
      if (designPrompt.length < 30 || designPrompt.length > 250) throw CLIUsageError('Inworld Voice Design prompt must contain 30-250 characters.')
      if (!Number.isInteger(designRequest.candidateCount) || designRequest.candidateCount < 1 || designRequest.candidateCount > 3) throw CLIUsageError('Inworld Voice Design supports one to three preview candidates.')
      const previewText = designRequest.previewText.trim()
      if (!previewText) throw CLIUsageError('Inworld Voice Design preview text cannot be blank.')
      const payload = record(await request({ method: 'POST', path: '/voices/v1/voices:design', body: {
        designPrompt,
        previewText,
        voiceDesignConfig: { numberOfSamples: designRequest.candidateCount }
      } }), 'voice design')
      const previews = Array.isArray(payload['previewVoices']) ? payload['previewVoices'].slice(0, designRequest.candidateCount) : []
      if (previews.length === 0) throw CLIUsageError('Inworld Voice Design returned no preview voices.')
      const result: ProviderVoiceDesignResult = {
        schemaVersion: 1,
        provider: 'inworld',
        operation: 'design',
        creationModel: designRequest.creationModel,
        previews: previews.map(value => {
          const preview = record(value, 'voice design preview')
          const providerCandidateId = trimmedString(preview['voiceId'])
          const audioBase64 = trimmedString(preview['previewAudio'])
          const returnedPreviewText = trimmedString(preview['previewText'])
          if (!providerCandidateId || !returnedPreviewText || !audioBase64) throw CLIUsageError('Inworld voice design preview omits voiceId, previewText, or previewAudio.')
          return { providerCandidateId, audioBase64, mediaType: 'audio/mpeg', sanitizedMetadata: { previewText: returnedPreviewText } }
        }),
        checkedAt: now()
      }
      return result
    },
    materializeCandidate: async materializeRequest => {
      const providerCandidateId = materializeRequest.providerCandidateId.trim()
      const desiredName = materializeRequest.desiredName.trim()
      if (!providerCandidateId || !desiredName) throw CLIUsageError('Inworld materialization requires the selected candidate ID and desired name.')
      const published = record(await request({ method: 'POST', path: `/voices/v1/voices/${encodeURIComponent(providerCandidateId)}:publish`, body: { displayName: desiredName } }), 'voice publish')
      const resourceId = trimmedString(published['voiceId'])
      if (!resourceId) throw CLIUsageError('Inworld voice publish response omits voiceId.')
      const checkedAt = now()
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource', provider: 'inworld', resourceId, namespace: 'account', accountScopeHash,
        origin: 'designed', ownership: 'project', deletion: { state: 'eligible', checkedAt },
        derivedFrom: {
          sourceRef: providerCandidateId,
          sourceIdentityHash: hashCanonicalTtsValue({ provider: 'inworld', candidateId: providerCandidateId }),
          operation: 'designed-from', localAttemptId: materializeRequest.localAttemptId, providerOperationId: providerCandidateId
        }
      }
      return { schemaVersion: 1, provider: 'inworld', state: 'ready', providerVoice, sanitizedMetadata: mapInworldVoice(published).sanitizedMetadata, checkedAt }
    }
  }

  const clone: VoiceClonePort = {
    clone: async cloneRequest => {
      assertAdvancedVoiceCloneAuthorized(identity, cloneRequest, 'references before any provider or external action')
      if (cloneRequest.cloneKind === 'professional') {
        const result: ProviderVoiceMutationResult = { schemaVersion: 1, provider: 'inworld', state: 'external-action-required', action: 'Complete the Inworld Professional Voice Cloning beta workflow in Portal, then import the resulting stable voice ID.', sanitizedMetadata: { cloneKind: 'professional', cloneChannel: 'inworld-portal', sampleCount: cloneRequest.protectedSamples.length }, checkedAt: now() }
        return result
      }
      if (cloneRequest.protectedSamples.length === 0 || !options.resolveProtectedAsset) throw CLIUsageError('Inworld Instant Voice Cloning requires protected samples and a protected-asset resolver.')
      const displayName = cloneRequest.desiredName.trim()
      if (!displayName) throw CLIUsageError('Inworld Instant Voice Cloning requires a display name.')
      const resolved = await Promise.all(cloneRequest.protectedSamples.map(sample => options.resolveProtectedAsset!(sample)))
      if (resolved.some(sample => sample.bytes.byteLength === 0)) throw CLIUsageError('Inworld Instant Voice Cloning samples cannot be empty.')
      const payload = record(await request({ method: 'POST', path: '/voices/v1/voices:clone', body: {
        displayName,
        voiceSamples: resolved.map(sample => ({ audioData: Buffer.from(sample.bytes).toString('base64'), ...(sample.transcription?.trim() ? { transcription: sample.transcription.trim() } : {}) })),
        ...(cloneRequest.description?.trim() ? { description: cloneRequest.description.trim() } : {})
      } }), 'voice clone')
      const voice = record(payload['voice'], 'cloned voice')
      const resourceId = trimmedString(voice['voiceId'])
      if (!resourceId) throw CLIUsageError('Inworld voice clone response omits voice.voiceId.')
      const checkedAt = now()
      const sourceSample = cloneRequest.protectedSamples[0]!
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource', provider: 'inworld', resourceId, namespace: 'account', accountScopeHash,
        origin: 'instant-clone', ownership: 'project', deletion: { state: 'eligible', checkedAt },
        derivedFrom: { sourceRef: sourceSample.assetId, sourceIdentityHash: sourceSample.sha256, operation: 'cloned-from', localAttemptId: cloneRequest.localAttemptId }
      }
      return { schemaVersion: 1, provider: 'inworld', state: 'ready', providerVoice, sanitizedMetadata: { cloneKind: 'instant', sampleCount: resolved.length, source: trimmedString(voice['source']) ?? 'IVC' }, checkedAt }
    }
  }

  const identity: AdvancedVoiceProviderIdentity = { provider: 'inworld', label: 'Inworld', labelWithArticle: 'an Inworld', accountScopeHash }
  const lifecycle = createRemoteResourceVoiceLifecycle(identity, { ownedResourceLabel: 'account voices' }, {
    fetchVoice: async voice => {
      const entry = mapInworldVoice(await request({ method: 'GET', path: `/voices/v1/voices/${encodeURIComponent(voice.resourceId)}` }))
      if (entry.resourceId !== voice.resourceId) throw CLIUsageError('Inworld inspection response identity does not match the registered resource.')
      return { state: entry.state === 'unavailable' ? 'missing' : entry.state, sanitizedMetadata: entry.sanitizedMetadata }
    },
    deleteVoice: async voice => {
      await request({ method: 'DELETE', path: `/voices/v1/voices/${encodeURIComponent(voice.resourceId)}` })
    },
    now
  })
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
