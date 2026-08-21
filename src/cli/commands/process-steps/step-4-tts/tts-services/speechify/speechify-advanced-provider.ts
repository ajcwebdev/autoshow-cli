import type {
  AnyCapabilityRecord,
  JsonObject,
  ProviderVoiceCatalogEntry,
  ProviderVoiceCatalogPage,
  ProviderVoiceCloneRequest,
  ProviderVoiceMutationResult,
  SpeechifyAdvancedProviderOptions,
  TtsVoiceProvider,
  VoiceCatalogPort,
  VoiceClonePort,
} from '~/types'
import { SPEECHIFY_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { CLIUsageError } from '~/utils/error-handler'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  createAdvancedProviderJsonRequest,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'
import { createProviderRecordReader, trimmedString } from '../advanced-provider-json'
import type { AdvancedVoiceProviderIdentity } from '../advanced-voice-provider-shell'
import { assertAdvancedVoiceCloneAuthorized, buildClonedProviderVoiceRef, createRemoteResourceVoiceLifecycle } from '../advanced-voice-provider-shell'

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
  { scope: { provider: 'speechify', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.create, DOCS.cloning]) },
  { scope: { provider: 'speechify', feature: 'professional-clone' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, reason: 'The public Speechify API documents one personal-voice cloning flow, not a separate professional-clone API.', documentationEvidence: evidence([DOCS.create, DOCS.cloning]) },
  { scope: { provider: 'speechify', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.delete]) },
  { scope: { provider: 'speechify', feature: 'word-timing' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { providerTimeUnit: 'milliseconds' }, documentationEvidence: evidence([DOCS.synthesis]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)
const SPEECHIFY_CLONE_SAMPLE_MAX_BYTES = 5 * 1024 * 1024

const record = createProviderRecordReader('Speechify')

const mapVoice = (value: unknown): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = trimmedString(voice['id'])
  const name = trimmedString(voice['display_name']) ?? trimmedString(voice['name'])
  if (!resourceId || !name) throw CLIUsageError('Speechify voice response omits id or display_name.')
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

export const createSpeechifyAdvancedProvider = (options: SpeechifyAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'clone' | 'lifecycle'> & {
  accountScopeHash: string
} => {
  const request = options.request ?? createAdvancedProviderJsonRequest({ baseUrl: SPEECHIFY_DEFAULT_BASE_URL, apiKey: `Bearer ${options.apiKey}`, apiKeyHeader: 'Authorization', providerLabel: 'Speechify' })
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('speechify', options.apiKey)

  const catalog: VoiceCatalogPort = {
    list: async input => {
      const source = input?.source ?? 'account'
      if (source === 'shared-library') throw CLIUsageError('Speechify exposes shared and personal voice types, not a shared-owner library namespace.')
      const payload = record(await request({ method: 'GET', path: '/v1/voices', query: { cursor: input?.cursor, limit: '100', type: source === 'account' ? 'personal' : 'shared' } }), 'voice catalog')
      const entries = Array.isArray(payload['voices']) ? payload['voices'].map(mapVoice) : []
      const nextCursor = payload['has_more'] === true ? trimmedString(payload['next_cursor']) : undefined
      const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'speechify', entries, ...(nextCursor ? { nextCursor } : {}), checkedAt: now() }
      return page
    }
  }

  const clone: VoiceClonePort = {
    clone: async cloneRequest => {
      assertAdvancedVoiceCloneAuthorized(identity, cloneRequest, 'before any external upload')
      if (cloneRequest.cloneKind === 'professional') {
        const result: ProviderVoiceMutationResult = { schemaVersion: 1, provider: 'speechify', state: 'external-action-required', action: 'Speechify does not document a separate professional-clone API; use the supported personal-voice clone workflow or manage any contracted workflow externally.', sanitizedMetadata: { cloneKind: 'professional', sampleCount: cloneRequest.protectedSamples.length }, checkedAt: now() }
        return result
      }
      if (cloneRequest.protectedSamples.length !== 1) throw CLIUsageError('Speechify voice cloning requires exactly one protected 10-30 second sample.')
      if (!options.resolveProtectedAsset || !options.resolveProtectedConsent) throw CLIUsageError('Speechify cloning requires protected asset and consent resolvers.')
      if (!cloneRequest.desiredName.trim()) throw CLIUsageError('Speechify cloning requires a voice name.')
      const [resolved, consent] = await Promise.all([
        options.resolveProtectedAsset(cloneRequest.protectedSamples[0] as ProviderVoiceCloneRequest['protectedSamples'][number]),
        options.resolveProtectedConsent(cloneRequest.consentRecordRef)
      ])
      if (resolved.bytes.byteLength === 0 || resolved.bytes.byteLength > SPEECHIFY_CLONE_SAMPLE_MAX_BYTES) throw CLIUsageError('Speechify clone sample must be non-empty and no larger than 5 MiB.')
      if (!Number.isFinite(resolved.durationMs) || resolved.durationMs < 10_000 || resolved.durationMs > 30_000) throw CLIUsageError('Speechify clone sample must have a verified duration of 10-30 seconds.')
      const fullName = consent.fullName.trim()
      const email = consent.email.trim()
      if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw CLIUsageError('Speechify protected consent must contain a full name and valid email address.')
      const locale = consent.locale?.trim() || 'en-US'
      const gender = consent.gender ?? 'not_specified'
      const form = new FormData()
      form.append('name', cloneRequest.desiredName)
      form.append('locale', locale)
      form.append('gender', gender)
      form.append('sample', new Blob([resolved.bytes], { type: resolved.mediaType }), resolved.fileName)
      form.append('consent', JSON.stringify({ fullName, email }))
      const entry = mapVoice(await request({ method: 'POST', path: '/v1/voices', headers: { 'Idempotency-Key': cloneRequest.localAttemptId }, body: form }) as unknown)
      const checkedAt = now()
      const providerVoice = buildClonedProviderVoiceRef(identity, {
        resourceId: entry.resourceId,
        sample: cloneRequest.protectedSamples[0]!,
        localAttemptId: cloneRequest.localAttemptId,
        checkedAt
      })
      return { schemaVersion: 1, provider: 'speechify', state: 'ready', providerVoice, sanitizedMetadata: { cloneKind: 'instant', sampleCount: 1, sampleDurationMs: resolved.durationMs, locale, gender }, checkedAt }
    }
  }

  const identity: AdvancedVoiceProviderIdentity = { provider: 'speechify', label: 'Speechify', labelWithArticle: 'a Speechify', accountScopeHash }
  const lifecycle = createRemoteResourceVoiceLifecycle(identity, { ownedResourceLabel: 'personal voices' }, {
    fetchVoice: async voice => {
      const entry = mapVoice(await request({ method: 'GET', path: `/v1/voices/${encodeURIComponent(voice.resourceId)}` }) as unknown)
      if (entry.resourceId !== voice.resourceId) throw CLIUsageError('Speechify inspection response identity does not match the registered resource.')
      return { state: 'available', sanitizedMetadata: entry.sanitizedMetadata }
    },
    deleteVoice: async voice => {
      await request({ method: 'DELETE', path: `/v1/voices/${encodeURIComponent(voice.resourceId)}` })
    },
    now
  })

  return { provider: 'speechify', accountScopeHash, getDeclaredCapabilities: () => SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.records, catalog, clone, lifecycle }
}
