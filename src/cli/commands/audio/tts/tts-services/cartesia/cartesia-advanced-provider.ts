import type { AnyCapabilityRecord, CartesiaAdvancedProviderOptions, ProviderVoiceCatalogEntry, ProviderVoiceCatalogPage, ProviderVoiceCloneRequest, ProviderVoiceMutationResult, TtsVoiceProvider, VoiceCatalogPort, VoiceClonePort } from '~/types'
import { CARTESIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { UsageError } from '~/utils/error-handler'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  createAdvancedProviderJsonRequest,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'
import { createProviderRecordReader, trimmedString } from '../advanced-provider-json'
import type { AdvancedVoiceProviderIdentity } from '~/types'
import { assertAdvancedVoiceCloneAuthorized, buildClonedProviderVoiceRef, createRemoteResourceVoiceLifecycle } from '../advanced-voice-provider-shell'

const CARTESIA_API_VERSION = '2026-03-01'

const DOCS = {
  catalog: 'https://docs.cartesia.ai/api-reference/voices/list',
  inspect: 'https://docs.cartesia.ai/api-reference/voices/get',
  clone: 'https://docs.cartesia.ai/api-reference/voices/clone',
  proClone: 'https://docs.cartesia.ai/build-with-cartesia/capability-guides/voice-cloning',
  delete: 'https://docs.cartesia.ai/api-reference/voices/delete',
  synthesis: 'https://docs.cartesia.ai/api-reference/tts/bytes',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const capabilityRecords = [
  { scope: { provider: 'cartesia', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['raw', 'wav', 'mp3'] }, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'cartesia', feature: 'native-dialogue' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 2 }, reason: 'Cartesia synthesis requests select one voice; contexts continue streaming input but do not provide a native multi-speaker dialogue contract.', documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'cartesia', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence([DOCS.catalog, DOCS.inspect]) },
  { scope: { provider: 'cartesia', feature: 'voice-design' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, reason: 'Cartesia does not document a text-prompt voice-design API.', documentationEvidence: evidence([DOCS.catalog, DOCS.clone]) },
  { scope: { provider: 'cartesia', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.clone]) },
  { scope: { provider: 'cartesia', feature: 'professional-clone' as const }, maturity: 'stable' as const, channel: 'ui-only' as const, adapterSupport: 'planned' as const, requirements: [{ kind: 'approval' as const, approvalKind: 'pro-voice-clone' }], constraints: { requiresConsent: true, createsRemoteResource: true }, reason: 'Cartesia Pro Voice Clone is a gated dashboard workflow rather than a public creation endpoint; the adapter reports the required external action.', documentationEvidence: evidence([DOCS.proClone]) },
  { scope: { provider: 'cartesia', feature: 'voice-import' as const }, maturity: 'stable' as const, channel: 'external-import' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: false }, documentationEvidence: evidence([DOCS.catalog, DOCS.inspect]) },
  { scope: { provider: 'cartesia', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.delete]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const CARTESIA_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

const record = createProviderRecordReader('Cartesia')

const mapVoice = (value: unknown): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = trimmedString(voice['id'])
  const name = trimmedString(voice['name'])
  if (!resourceId || !name) throw UsageError('Cartesia voice response omits id or name.')
  const isOwner = voice['is_owner'] === true
  const labels = Object.fromEntries([
    ['gender', trimmedString(voice['gender'])],
    ['language', trimmedString(voice['language'])],
    ['country', trimmedString(voice['country'])],
  ].flatMap(([key, item]) => item ? [[key as string, item]] : []))
  return {
    provider: 'cartesia', resourceId, name,
    source: isOwner ? 'account' : 'provider-library',
    origin: isOwner ? 'imported-custom' : 'provider-stock',
    ...(trimmedString(voice['preview_file_url']) ? { previewUrl: trimmedString(voice['preview_file_url']) } : {}),
    ...(trimmedString(voice['description']) ? { description: trimmedString(voice['description']) } : {}),
    labels, modelIds: [], state: 'available',
    sanitizedMetadata: {
      isOwner,
      ...(typeof voice['is_public'] === 'boolean' ? { isPublic: voice['is_public'] } : {}),
      ...(trimmedString(voice['created_at']) ? { createdAt: trimmedString(voice['created_at']) as string } : {})
    }
  }
}

export const createCartesiaAdvancedProvider = (options: CartesiaAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'clone' | 'lifecycle'> & {
  accountScopeHash: string
} => {
  const request = options.request ?? createAdvancedProviderJsonRequest({
    baseUrl: CARTESIA_DEFAULT_BASE_URL,
    apiKey: `Bearer ${options.apiKey}`,
    apiKeyHeader: 'Authorization',
    providerLabel: 'Cartesia',
    defaultHeaders: { 'Cartesia-Version': CARTESIA_API_VERSION }
  })
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('cartesia', options.apiKey)

  const catalog: VoiceCatalogPort = {
    list: async input => {
      const source = input?.source ?? 'account'
      if (source === 'shared-library') throw UsageError('Cartesia exposes public and account voices, not a shared-owner namespace.')
      const payload = record(await request({ method: 'GET', path: '/voices', query: {
        limit: '100',
        ...(input?.cursor ? { starting_after: input.cursor } : {}),
        is_owner: source === 'account' ? 'true' : 'false',
        'expand[]': 'preview_file_url'
      } }), 'voice catalog')
      const entries = Array.isArray(payload['data']) ? payload['data'].map(mapVoice) : []
      const nextCursor = payload['has_more'] === true ? trimmedString(payload['next_page']) : undefined
      const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'cartesia', entries, ...(nextCursor ? { nextCursor } : {}), checkedAt: now() }
      return page
    }
  }

  const clone: VoiceClonePort = {
    clone: async cloneRequest => {
      assertAdvancedVoiceCloneAuthorized(identity, cloneRequest, 'before any external upload')
      if (cloneRequest.cloneKind === 'professional') {
        const result: ProviderVoiceMutationResult = { schemaVersion: 1, provider: 'cartesia', state: 'external-action-required', action: 'Complete the gated Cartesia Pro Voice Clone workflow in the dashboard, then import its stable voice ID.', sanitizedMetadata: { cloneKind: 'professional', cloneChannel: 'cartesia-dashboard', sampleCount: cloneRequest.protectedSamples.length }, checkedAt: now() }
        return result
      }
      if (cloneRequest.protectedSamples.length !== 1) throw UsageError('Cartesia Instant Voice Clone requires exactly one protected sample.')
      if (!options.resolveProtectedAsset) throw UsageError('Cartesia cloning requires a protected-asset resolver.')
      if (!cloneRequest.desiredName.trim()) throw UsageError('Cartesia cloning requires a voice name.')
      const language = options.cloneLanguage?.trim() || 'en'
      const resolved = await options.resolveProtectedAsset(cloneRequest.protectedSamples[0] as ProviderVoiceCloneRequest['protectedSamples'][number])
      const form = new FormData()
      form.append('clip', new Blob([resolved.bytes], { type: resolved.mediaType }), resolved.fileName)
      form.append('name', cloneRequest.desiredName)
      form.append('language', language)
      if (cloneRequest.description) form.append('description', cloneRequest.description)
      const entry = mapVoice(await request({ method: 'POST', path: '/voices/clone', body: form }) as unknown)
      const checkedAt = now()
      const providerVoice = buildClonedProviderVoiceRef(identity, {
        resourceId: entry.resourceId,
        sample: cloneRequest.protectedSamples[0]!,
        localAttemptId: cloneRequest.localAttemptId,
        checkedAt
      })
      return { schemaVersion: 1, provider: 'cartesia', state: 'ready', providerVoice, sanitizedMetadata: { cloneKind: 'instant', sampleCount: 1, language }, checkedAt }
    }
  }

  const identity: AdvancedVoiceProviderIdentity = { provider: 'cartesia', label: 'Cartesia', labelWithArticle: 'a Cartesia', accountScopeHash }
  const lifecycle = createRemoteResourceVoiceLifecycle(identity, { ownedResourceLabel: 'account voices' }, {
    fetchVoice: async voice => {
      const entry = mapVoice(await request({ method: 'GET', path: `/voices/${encodeURIComponent(voice.resourceId)}`, query: { 'expand[]': 'preview_file_url' } }) as unknown)
      if (entry.resourceId !== voice.resourceId) throw UsageError('Cartesia inspection response identity does not match the registered resource.')
      return { state: 'available', sanitizedMetadata: entry.sanitizedMetadata }
    },
    deleteVoice: async voice => {
      await request({ method: 'DELETE', path: `/voices/${encodeURIComponent(voice.resourceId)}` })
    },
    now
  })

  return { provider: 'cartesia', accountScopeHash, getDeclaredCapabilities: () => CARTESIA_ADVANCED_CAPABILITY_FIXTURE.records, catalog, clone, lifecycle }
}
