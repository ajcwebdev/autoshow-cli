import type {
  AnyCapabilityRecord,
  JsonObject,
  ProviderVoiceCatalogEntry,
  ProviderVoiceCatalogPage,
  SpeechifyAdvancedProviderOptions,
  TtsVoiceProvider,
  VoiceCatalogPort,
} from '~/types'
import { SPEECHIFY_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { UsageError } from '~/utils/error-handler'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  createAdvancedProviderJsonRequest,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'
import { createProviderRecordReader, trimmedString } from '../advanced-provider-json'
import type { AdvancedVoiceProviderIdentity } from '~/types'
import { createRemoteResourceVoiceLifecycle } from '../advanced-voice-provider-shell'

const DOCS = {
  catalog: 'https://docs.speechify.ai/build/api-reference/v1/voices/get',
  create: 'https://docs.speechify.ai/build/api-reference/v1/voices/post',
  inspect: 'https://docs.speechify.ai/build/api-reference/v1/voices/-id-/get',
  delete: 'https://docs.speechify.ai/build/api-reference/v1/voices/-id-/delete',
  cloning: 'https://docs.speechify.ai/build/guides/voice-cloning/overview',
  synthesis: 'https://docs.speechify.ai/build/api-reference/v1/audio/speech/post',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const capabilityRecords = [
  { scope: { provider: 'speechify', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['mp3', 'wav', 'ogg', 'aac'] }, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'speechify', feature: 'native-dialogue' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 2 }, reason: 'Speechify synthesis requests select one voice_id and do not document a native multi-speaker dialogue contract.', documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'speechify', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence([DOCS.catalog, DOCS.inspect]) },
  { scope: { provider: 'speechify', feature: 'voice-design' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, reason: 'Speechify does not document a text-prompt voice-design API.', documentationEvidence: evidence([DOCS.catalog, DOCS.cloning]) },
  { scope: { provider: 'speechify', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'planned' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, reason: 'The current Speechify workflow requires a challenge phrase and a separate consent recording; this pass intentionally defers that provider-specific contract.', documentationEvidence: evidence([DOCS.create, DOCS.cloning]) },
  { scope: { provider: 'speechify', feature: 'professional-clone' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, reason: 'The public Speechify API documents one personal-voice cloning flow, not a separate professional-clone API.', documentationEvidence: evidence([DOCS.create, DOCS.cloning]) },
  { scope: { provider: 'speechify', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.delete]) },
  { scope: { provider: 'speechify', feature: 'word-timing' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { providerTimeUnit: 'milliseconds' }, documentationEvidence: evidence([DOCS.synthesis]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)
const record = createProviderRecordReader('Speechify')

const mapVoice = (value: unknown): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = trimmedString(voice['id'])
  const name = trimmedString(voice['display_name']) ?? trimmedString(voice['name'])
  if (!resourceId || !name) throw UsageError('Speechify voice response omits id or display_name.')
  const type = trimmedString(voice['type'])
  const models = Array.isArray(voice['models']) ? voice['models'] : []
  const modelIds = models.flatMap(value => value && typeof value === 'object' && !Array.isArray(value) ? trimmedString((value as JsonObject)['name']) ?? [] : [])
  const tags = Array.isArray(voice['tags']) ? voice['tags'].flatMap(value => trimmedString(value) ?? []) : []
  return {
    provider: 'speechify', resourceId, name,
    source: type === 'personal' ? 'account' : 'provider-library',
    origin: type === 'personal' ? 'instant-clone' : 'provider-stock',
    ...(trimmedString(voice['preview_audio']) ? { previewUrl: trimmedString(voice['preview_audio']) } : {}),
    labels: Object.fromEntries([
      ['gender', trimmedString(voice['gender'])],
      ['locale', trimmedString(voice['locale'])],
    ].flatMap(([key, item]) => item ? [[key as string, item]] : [])),
    modelIds,
    state: 'available',
    sanitizedMetadata: { ...(type ? { type } : {}), ...(tags.length > 0 ? { tags } : {}) }
  }
}

export const createSpeechifyAdvancedProvider = (options: SpeechifyAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'lifecycle'> & {
  accountScopeHash: string
} => {
  const request = options.request ?? createAdvancedProviderJsonRequest({ baseUrl: SPEECHIFY_DEFAULT_BASE_URL, apiKey: `Bearer ${options.apiKey}`, apiKeyHeader: 'Authorization', providerLabel: 'Speechify' })
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('speechify', options.apiKey)

  const catalog: VoiceCatalogPort = {
    list: async input => {
      const source = input?.source ?? 'account'
      if (source === 'shared-library') throw UsageError('Speechify exposes shared and personal voice types, not a shared-owner library namespace.')
      const payload = record(await request({ method: 'GET', path: '/v1/voices', query: { cursor: input?.cursor, limit: '100', type: source === 'account' ? 'personal' : 'shared' } }), 'voice catalog')
      const entries = Array.isArray(payload['voices']) ? payload['voices'].map(mapVoice) : []
      const nextCursor = payload['has_more'] === true ? trimmedString(payload['next_cursor']) : undefined
      const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'speechify', entries, ...(nextCursor ? { nextCursor } : {}), checkedAt: now() }
      return page
    }
  }

  const identity: AdvancedVoiceProviderIdentity = { provider: 'speechify', label: 'Speechify', labelWithArticle: 'a Speechify', accountScopeHash }
  const lifecycle = createRemoteResourceVoiceLifecycle(identity, { ownedResourceLabel: 'personal voices' }, {
    fetchVoice: async voice => {
      const entry = mapVoice(await request({ method: 'GET', path: `/v1/voices/${encodeURIComponent(voice.resourceId)}` }) as unknown)
      if (entry.resourceId !== voice.resourceId) throw UsageError('Speechify inspection response identity does not match the registered resource.')
      return { state: 'available', sanitizedMetadata: entry.sanitizedMetadata }
    },
    deleteVoice: async voice => {
      await request({ method: 'DELETE', path: `/v1/voices/${encodeURIComponent(voice.resourceId)}` })
    },
    now
  })

  return { provider: 'speechify', accountScopeHash, getDeclaredCapabilities: () => SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.records, catalog, lifecycle }
}
