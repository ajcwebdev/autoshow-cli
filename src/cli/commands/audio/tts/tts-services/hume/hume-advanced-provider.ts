import type { AnyCapabilityRecord, HumeAdvancedProviderOptions, HumeVoiceCatalogEnvelope, ProviderVoiceCatalogEntry, ProviderVoiceCatalogPage, ProviderVoiceDesignResult, ProviderVoiceInspection, ProviderVoiceMutationResult, ProviderVoiceRef, ResolvedContinuationInput, TtsVoiceProvider, VoiceCatalogPort, VoiceClonePort, VoiceDesignPort, VoiceLifecyclePort } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from '../../script-to-audio/contract-identity'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  createAdvancedProviderJsonRequest,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'
import { createProviderRecordReader, trimmedString } from '../advanced-provider-json'
import type { AdvancedVoiceProviderIdentity } from '~/types'
import { assertAdvancedVoiceCloneAuthorized, assertAdvancedVoiceDeletable, assertAdvancedVoiceInspectionIdentity, buildAdvancedVoiceInspection } from '../advanced-voice-provider-shell'

const DOCS = {
  overview: 'https://dev.hume.ai/docs/text-to-speech-tts/overview',
  voice: 'https://dev.hume.ai/docs/text-to-speech-tts/voice',
  design: 'https://dev.hume.ai/docs/voice/voice-design',
  clone: 'https://dev.hume.ai/docs/voice/voice-cloning',
  management: 'https://dev.hume.ai/docs/voice/management',
  synthesis: 'https://dev.hume.ai/reference/text-to-speech-tts/synthesize-json',
  timestamps: 'https://dev.hume.ai/docs/text-to-speech-tts/timestamps',
  continuation: 'https://dev.hume.ai/docs/text-to-speech-tts/continuation',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const capabilityRecords = [
  { scope: { provider: 'hume', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], maxCharacters: 5000, supportedOutputFormats: ['mp3', 'wav', 'pcm'] }, documentationEvidence: evidence([DOCS.overview, DOCS.synthesis]) },
  { scope: { provider: 'hume', feature: 'native-utterances' as const, model: 'octave-2', transport: 'hosted-api' }, maturity: 'preview' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], maxCharacters: 5000, supportedOutputFormats: ['mp3', 'wav', 'pcm'], maxTakesPerRequest: 5 }, documentationEvidence: evidence([DOCS.overview, DOCS.synthesis]) },
  { scope: { provider: 'hume', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence([DOCS.management]) },
  { scope: { provider: 'hume', feature: 'voice-design' as const, model: 'octave-1', transport: 'hosted-api' }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.design]) },
  { scope: { provider: 'hume', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'ui-only' as const, adapterSupport: 'planned' as const, requirements: [{ kind: 'plan' as const }], constraints: { requiresConsent: true, createsRemoteResource: true }, reason: 'The documented clone workflow is subscription-gated and currently performed in the Hume platform; the adapter reports the external action and imports its stable custom voice ID.', documentationEvidence: evidence([DOCS.clone]) },
  { scope: { provider: 'hume', feature: 'voice-import' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: false }, documentationEvidence: evidence([DOCS.voice, DOCS.management]) },
  { scope: { provider: 'hume', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.management]) },
  { scope: { provider: 'hume', feature: 'acting-description' as const, model: 'octave-1', transport: 'hosted-api' }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { maxCharacters: 1000 }, documentationEvidence: evidence([DOCS.design, DOCS.synthesis]) },
  { scope: { provider: 'hume', feature: 'word-timing' as const, model: 'octave-2', transport: 'hosted-api' }, maturity: 'preview' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { providerTimeUnit: 'milliseconds' }, documentationEvidence: evidence([DOCS.timestamps]) },
  { scope: { provider: 'hume', feature: 'phoneme-timing' as const, model: 'octave-2', transport: 'hosted-api' }, maturity: 'preview' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { providerTimeUnit: 'milliseconds' }, documentationEvidence: evidence([DOCS.timestamps]) },
  { scope: { provider: 'hume', feature: 'continuation' as const, transport: 'hosted-api' }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { providerVersions: ['1', '2'] }, documentationEvidence: evidence([DOCS.continuation]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const HUME_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

const record = createProviderRecordReader('Hume')
export const parseHumeVoiceCatalogEnvelope = (payload: unknown): HumeVoiceCatalogEnvelope => {
  if (Array.isArray(payload)) return { voices: payload, pageNumber: 0, totalPages: 1 }
  const response = record(payload, 'voice catalog')
  const voices = Array.isArray(response['voices_page'])
    ? response['voices_page'] as unknown[]
    : Array.isArray(response['voices']) ? response['voices'] as unknown[] : []
  const pageNumber = typeof response['page_number'] === 'number' && Number.isInteger(response['page_number']) && response['page_number'] >= 0
    ? response['page_number']
    : 0
  const totalPages = typeof response['total_pages'] === 'number' && Number.isInteger(response['total_pages']) && response['total_pages'] >= 0
    ? response['total_pages']
    : 1
  if (totalPages > 10_000 || pageNumber >= Math.max(totalPages, 1)) throw UsageError('Hume voice catalog pagination metadata is invalid.')
  return { voices, pageNumber, totalPages }
}

const mapVoice = (value: unknown): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = trimmedString(voice['id'])
  const name = trimmedString(voice['name'])
  const provider = trimmedString(voice['provider'])
  if (!resourceId || !name || (provider !== 'HUME_AI' && provider !== 'CUSTOM_VOICE')) throw UsageError('Hume voice response omits a stable id, name, or recognized provider.')
  return {
    provider: 'hume', resourceId, name,
    source: provider === 'CUSTOM_VOICE' ? 'account' : 'provider-library',
    origin: provider === 'CUSTOM_VOICE' ? 'imported-custom' : 'provider-stock',
    labels: {}, modelIds: [], state: 'available',
    sanitizedMetadata: { voiceProvider: provider }
  }
}

export const resolveUniqueHumeVoiceName = (
  entries: readonly ProviderVoiceCatalogEntry[],
  name: string
): ProviderVoiceCatalogEntry => {
  const normalized = name.trim()
  if (!normalized) throw UsageError('Hume voice name cannot be blank.')
  const matching = entries.filter(entry => entry.name === normalized)
  if (matching.length !== 1) throw UsageError(`Hume voice name ${normalized} must resolve to exactly one stable provider ID.`)
  return matching[0] as ProviderVoiceCatalogEntry
}

export const validateHumeContinuation = (continuation: ResolvedContinuationInput, version: '1' | '2'): void => {
  if (continuation.kind === 'none') return
  if (continuation.provider !== 'hume') throw UsageError('Hume continuation checkpoint belongs to another provider.')
  if (continuation.providerVersion !== version) throw UsageError(`Hume Octave ${version} cannot consume an Octave ${continuation.providerVersion} continuation checkpoint.`)
  if (continuation.continuationState.kind !== 'provider-generation-id' || !continuation.continuationState.value.trim()) throw UsageError('Hume continuation requires the selected prior generation ID.')
}

export const createHumeAdvancedProvider = (options: HumeAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle' | 'continuation'> & {
  accountScopeHash: string
} => {
  const request = options.request ?? createAdvancedProviderJsonRequest({ baseUrl: 'https://api.hume.ai', apiKey: options.apiKey, apiKeyHeader: 'X-Hume-Api-Key', providerLabel: 'Hume' })
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('hume', options.apiKey)

  const listVoices = async (source?: 'provider-library' | 'shared-library' | 'account', cursor?: string): Promise<ProviderVoiceCatalogPage> => {
    if (source === 'shared-library') throw UsageError('Hume has a provider library, not an ElevenLabs-style shared-owner voice namespace.')
    const pageNumber = cursor ?? '0'
    if (!/^(0|[1-9]\d*)$/.test(pageNumber)) throw UsageError('Hume voice catalog cursor must be a zero-based page number.')
    const payload = await request({ method: 'GET', path: '/v0/tts/voices', query: {
      provider: source === 'account' ? 'CUSTOM_VOICE' : 'HUME_AI',
      page_number: pageNumber,
      page_size: '100'
    } })
    const envelope = parseHumeVoiceCatalogEnvelope(payload)
    const nextCursor = envelope.pageNumber + 1 < envelope.totalPages ? String(envelope.pageNumber + 1) : undefined
    return { schemaVersion: 1, provider: 'hume', entries: envelope.voices.map(mapVoice), ...(nextCursor ? { nextCursor } : {}), checkedAt: now() }
  }
  const listAllVoices = async (source: 'provider-library' | 'account'): Promise<ProviderVoiceCatalogEntry[]> => {
    const entries: ProviderVoiceCatalogEntry[] = []
    let cursor: string | undefined
    do {
      const page = await listVoices(source, cursor)
      entries.push(...page.entries)
      cursor = page.nextCursor
    } while (cursor)
    return entries
  }
  const catalog: VoiceCatalogPort = { list: async input => await listVoices(input?.source, input?.cursor) }

  const design: VoiceDesignPort = {
    createCandidate: async designRequest => {
      if (designRequest.sourceVoice) throw UsageError('Hume does not expose a remix operation; design a new voice or import an existing custom voice.')
      if (designRequest.creationModel !== 'octave-1') throw UsageError('Hume Voice Design requires creation model octave-1 even when the saved voice will synthesize with Octave 2.')
      if (designRequest.candidateCount < 1 || designRequest.candidateCount > 5) throw UsageError('Hume Voice Design supports one to five candidates per bounded request.')
      if (!designRequest.description.trim() || designRequest.description.length > 1000) throw UsageError('Hume Voice Design description must contain 1-1000 characters.')
      if (designRequest.seed !== undefined) throw UsageError('Hume Voice Design does not expose a deterministic seed.')
      const payload = record(await request({ method: 'POST', path: '/v0/tts', body: {
        version: '1',
        utterances: [{ text: designRequest.previewText, description: designRequest.description }],
        num_generations: designRequest.candidateCount,
        format: { type: 'mp3' }
      } }), 'voice design')
      const generations = Array.isArray(payload['generations']) ? payload['generations'] : []
      if (generations.length === 0) throw UsageError('Hume Voice Design returned no generations.')
      const result: ProviderVoiceDesignResult = {
        schemaVersion: 1, provider: 'hume', operation: 'design', creationModel: 'octave-1',
        previews: generations.map(value => {
          const generation = record(value, 'voice design generation')
          const providerCandidateId = trimmedString(generation['generation_id'])
          const audioBase64 = trimmedString(generation['audio'])
          if (!providerCandidateId || !audioBase64) throw UsageError('Hume design generation omits generation_id or audio.')
          return {
            providerCandidateId, audioBase64, mediaType: 'audio/mpeg',
            ...(typeof generation['duration'] === 'number' ? { durationMs: Math.round(generation['duration'] * 1000) } : {}),
            sanitizedMetadata: { expiryState: 'not-exposed', creationVersion: '1' }
          }
        }),
        checkedAt: now()
      }
      return result
    },
    materializeCandidate: async materializeRequest => {
      if (!materializeRequest.providerCandidateId.trim() || !materializeRequest.desiredName.trim()) throw UsageError('Hume materialization requires the selected generation ID and desired name.')
      const response = record(await request({ method: 'POST', path: '/v0/tts/voices', body: { generation_id: materializeRequest.providerCandidateId, name: materializeRequest.desiredName } }), 'voice materialization')
      const resourceId = trimmedString(response['id'])
      if (!resourceId) throw UsageError('Hume voice materialization returned no stable ID.')
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource', provider: 'hume', resourceId, namespace: 'account', accountScopeHash,
        origin: 'designed', ownership: 'project', deletion: { state: 'eligible', checkedAt: now() },
        derivedFrom: { sourceRef: materializeRequest.providerCandidateId, sourceIdentityHash: hashCanonicalTtsValue({ provider: 'hume', generationId: materializeRequest.providerCandidateId }), operation: 'designed-from', localAttemptId: materializeRequest.localAttemptId, providerOperationId: materializeRequest.providerCandidateId }
      }
      return { schemaVersion: 1, provider: 'hume', state: 'ready', providerVoice, sanitizedMetadata: { creationModel: 'octave-1', synthesisCompatibility: 'octave-1,octave-2' }, checkedAt: now() }
    }
  }

  const clone: VoiceClonePort = {
    clone: async cloneRequest => {
      assertAdvancedVoiceCloneAuthorized(identity, cloneRequest, 'before any external upload')
      const result: ProviderVoiceMutationResult = {
        schemaVersion: 1, provider: 'hume', state: 'external-action-required',
        action: 'Create the subscription-gated clone in the Hume platform, then import its CUSTOM_VOICE ID with voice import.',
        sanitizedMetadata: { cloneChannel: 'hume-platform', sampleCount: cloneRequest.protectedSamples.length }, checkedAt: now()
      }
      return result
    }
  }

  const identity: AdvancedVoiceProviderIdentity = { provider: 'hume', label: 'Hume', labelWithArticle: 'a Hume', accountScopeHash }
  const inspect = async (voice: ProviderVoiceRef): Promise<ProviderVoiceInspection> => {
    const remote = assertAdvancedVoiceInspectionIdentity(identity, voice)
    const entries = await listAllVoices(remote.namespace === 'account' ? 'account' : 'provider-library')
    const matching = entries.filter(entry => entry.resourceId === remote.resourceId)
    return buildAdvancedVoiceInspection(identity, {
      voice: remote,
      state: matching.length === 0 ? 'missing' : 'available',
      sanitizedMetadata: matching.length === 0 ? {} : matching[0]?.sanitizedMetadata ?? {},
      checkedAt: now()
    })
  }
  const lifecycle: VoiceLifecyclePort = {
    inspect,
    delete: async deleteRequest => {
      const voice = assertAdvancedVoiceDeletable(identity, { ownedResourceLabel: 'custom voices' }, deleteRequest)
      const expectedName = deleteRequest.expectedName?.trim()
      if (!expectedName) throw UsageError('Hume deletion requires the expected mutable name for a fresh unique proof.')
      const custom = await listAllVoices('account')
      let resolved: ProviderVoiceCatalogEntry
      try { resolved = resolveUniqueHumeVoiceName(custom, expectedName) }
      catch { throw UsageError('Hume deletion requires a fresh unique name-to-expected-ID proof; use an external action when the name is ambiguous or changed.') }
      if (resolved.resourceId !== voice.resourceId) throw UsageError('Hume deletion requires a fresh unique name-to-expected-ID proof; use an external action when the name is ambiguous or changed.')
      await request({ method: 'DELETE', path: '/v0/tts/voices', query: { name: expectedName } })
      return { deletedAt: now() }
    }
  }

  return {
    provider: 'hume', accountScopeHash,
    getDeclaredCapabilities: () => HUME_ADVANCED_CAPABILITY_FIXTURE.records,
    catalog, design, clone, lifecycle,
    continuation: { validate: continuation => {
      try { validateHumeContinuation(continuation, '2'); return { status: 'valid', candidateIds: ['hume-octave-2-continuation'] } }
      catch (error) { return { status: 'invalid', errors: [{ phase: 'static-validation', code: 'hume_continuation_invalid', message: error instanceof Error ? error.message : String(error), retryable: false }] } }
    } }
  }
}
