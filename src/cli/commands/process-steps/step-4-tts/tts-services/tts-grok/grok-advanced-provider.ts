import type {
  AdvancedVoiceProviderIdentity,
  AnyCapabilityRecord,
  GrokAdvancedProviderOptions,
  JsonObject,
  ProviderVoiceCatalogEntry,
  ProviderVoiceCatalogPage,
  ProviderVoiceMutationResult,
  ProviderVoiceRef,
  SanitizedProviderVoiceMetadata,
  TtsVoiceProvider,
  VoiceCatalogPort,
  VoiceClonePort,
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { buildAdvancedCapabilityFixture, buildCapabilityDocumentationEvidence, createAdvancedProviderJsonRequest, providerAccountScopeHash } from '../../script-to-audio/advanced-provider-contracts'
import { assertAdvancedVoiceCloneAuthorized, createRemoteResourceVoiceLifecycle } from '../advanced-voice-provider-shell'
import { createProviderRecordReader, trimmedString } from '../advanced-provider-json'

const DOCS = {
  voices: 'https://docs.x.ai/developers/api-reference#tts-voices',
  customVoices: 'https://docs.x.ai/developers/model-capabilities/audio/custom-voices',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs, '2026-08-29T00:00:00.000Z')
const customVoiceRequirements = [
  { kind: 'plan' as const, tier: 'Enterprise' },
  { kind: 'region' as const, allowedRegionCodes: ['US'], excludedSubdivisionCodes: ['US-IL'] },
]
const capabilityRecords = [
  { scope: { provider: 'grok', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: customVoiceRequirements, constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence([DOCS.voices, DOCS.customVoices]) },
  { scope: { provider: 'grok', feature: 'voice-design' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: false }, reason: 'xAI documents custom voice cloning but not text-prompt voice design.', documentationEvidence: evidence([DOCS.customVoices]) },
  { scope: { provider: 'grok', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: customVoiceRequirements, constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.customVoices]) },
  { scope: { provider: 'grok', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: customVoiceRequirements, constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.customVoices]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const GROK_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)
export const GROK_CUSTOM_VOICE_ATTEMPT_MARKER_PREFIX = 'autoshow-attempt:'

const record = createProviderRecordReader('Grok')
const customVoiceId = (value: unknown): string => {
  const id = trimmedString(value)
  if (!id || !/^[a-z0-9]{8}$/.test(id)) throw UsageError('Grok custom voice response must contain an 8-character lowercase alphanumeric voice_id.')
  return id
}

const sanitizedMetadata = (voice: JsonObject): SanitizedProviderVoiceMetadata => {
  const metadata: SanitizedProviderVoiceMetadata = {}
  for (const key of ['name', 'description', 'gender', 'accent', 'age', 'language', 'use_case', 'tone', 'created_at'] as const) {
    const value = trimmedString(voice[key])
    if (value) metadata[key] = value
  }
  return metadata
}

const mapVoice = (value: unknown, source: 'provider-library' | 'account'): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = source === 'account' ? customVoiceId(voice['voice_id']) : trimmedString(voice['voice_id'])
  if (!resourceId) throw UsageError('Grok built-in voice response omits voice_id.')
  return {
    provider: 'grok',
    resourceId,
    name: trimmedString(voice['name']) ?? resourceId,
    source,
    origin: source === 'provider-library' ? 'provider-stock' : 'instant-clone',
    ...(trimmedString(voice['description']) ? { description: trimmedString(voice['description']) } : {}),
    labels: {},
    modelIds: ['grok-tts'],
    state: 'available',
    sanitizedMetadata: sanitizedMetadata(voice),
  }
}

export const grokVoiceAttemptMarker = (localAttemptId: string): string => `${GROK_CUSTOM_VOICE_ATTEMPT_MARKER_PREFIX}${localAttemptId}`

export const findGrokCustomVoiceByAttemptMarker = async (input: {
  request: NonNullable<GrokAdvancedProviderOptions['request']>
  localAttemptId: string
  now?: (() => string) | undefined
}): Promise<ProviderVoiceCatalogEntry | undefined> => {
  const marker = grokVoiceAttemptMarker(input.localAttemptId)
  let cursor: string | undefined
  const matches: ProviderVoiceCatalogEntry[] = []
  for (let page = 0; page < 1000; page += 1) {
    const payload = record(await input.request({ method: 'GET', path: '/v1/custom-voices', query: { limit: '1000', pagination_token: cursor } }), 'custom voice catalog')
    const voices = Array.isArray(payload['voices']) ? payload['voices'] : []
    for (const value of voices) {
      const voice = record(value, 'custom voice')
      if (trimmedString(voice['description'])?.includes(marker)) matches.push(mapVoice(voice, 'account'))
    }
    const next = trimmedString(payload['pagination_token'])
    if (!next) break
    cursor = next
    if (page === 999) throw UsageError('Grok custom voice reconciliation pagination exceeded its safety limit.')
  }
  if (matches.length > 1) throw UsageError('Grok custom voice reconciliation found multiple resources with the durable attempt marker.')
  return matches[0]
}

export const createGrokAdvancedProvider = (options: GrokAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const request = options.request ?? createAdvancedProviderJsonRequest({
    baseUrl: new URL(XAI_DEFAULT_BASE_URL).origin,
    apiKey: `Bearer ${options.apiKey}`,
    apiKeyHeader: 'Authorization',
    providerLabel: 'Grok',
  })
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('grok', options.apiKey)
  const identity: AdvancedVoiceProviderIdentity = { provider: 'grok', label: 'Grok', labelWithArticle: 'a Grok', accountScopeHash }

  const catalog: VoiceCatalogPort = {
    list: async input => {
      const source = input?.source ?? 'account'
      if (source === 'shared-library') throw UsageError('Grok does not expose a shared-owner voice-library namespace.')
      if (source === 'provider-library' && input?.cursor) throw UsageError('Grok built-in voice discovery is not paginated and does not accept a cursor.')
      const payload = record(await request(source === 'provider-library'
        ? { method: 'GET', path: '/v1/tts/voices' }
        : { method: 'GET', path: '/v1/custom-voices', query: { limit: '1000', pagination_token: input?.cursor } }), 'voice catalog')
      const entries = Array.isArray(payload['voices']) ? payload['voices'].map(value => mapVoice(value, source)) : []
      const nextCursor = source === 'account' ? trimmedString(payload['pagination_token']) : undefined
      const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'grok', entries, ...(nextCursor ? { nextCursor } : {}), checkedAt: now() }
      return page
    }
  }

  const clone: VoiceClonePort = {
    clone: async cloneRequest => {
      assertAdvancedVoiceCloneAuthorized(identity, cloneRequest, 'before any provider upload')
      if (cloneRequest.cloneKind !== 'instant') throw UsageError('Grok does not expose a professional voice-clone API.')
      if (cloneRequest.protectedSamples.length !== 1) throw UsageError('Grok custom voice cloning requires exactly one protected sample.')
      if (!options.resolveProtectedAsset) throw UsageError('Grok cloning requires a protected-asset resolver.')
      const sample = cloneRequest.protectedSamples[0]!
      const resolved = await options.resolveProtectedAsset(sample)
      if (resolved.bytes.byteLength === 0) throw UsageError('Grok custom voice sample cannot be empty.')
      if (!Number.isFinite(resolved.durationMs) || resolved.durationMs <= 0 || resolved.durationMs > 120_000) throw UsageError('Grok custom voice sample must have a measured duration greater than 0 and at most 120 seconds.')
      const marker = grokVoiceAttemptMarker(cloneRequest.localAttemptId)
      const description = [cloneRequest.description?.trim(), marker].filter(Boolean).join(' | ')
      const form = new FormData()
      form.set('name', cloneRequest.desiredName)
      form.set('description', description)
      form.set('file', new Blob([resolved.bytes], { type: resolved.mediaType }), resolved.fileName)
      const created = record(await request({ method: 'POST', path: '/v1/custom-voices', body: form }), 'custom voice create')
      const resourceId = customVoiceId(created['voice_id'])
      const checkedAt = now()
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource', provider: 'grok', resourceId, namespace: 'account', accountScopeHash,
        origin: 'instant-clone', ownership: 'project', deletion: { state: 'eligible', checkedAt },
        derivedFrom: { sourceRef: sample.assetId, sourceIdentityHash: sample.sha256, operation: 'cloned-from', localAttemptId: cloneRequest.localAttemptId }
      }
      const result: ProviderVoiceMutationResult = { schemaVersion: 1, provider: 'grok', state: 'ready', providerVoice, sanitizedMetadata: { ...sanitizedMetadata(created), attemptMarker: marker, sampleDurationMs: resolved.durationMs }, checkedAt }
      return result
    }
  }

  const lifecycle = createRemoteResourceVoiceLifecycle(identity, { ownedResourceLabel: 'custom voices' }, {
    fetchVoice: async voice => {
      const entry = mapVoice(await request({ method: 'GET', path: `/v1/custom-voices/${encodeURIComponent(voice.resourceId)}` }), 'account')
      if (entry.resourceId !== voice.resourceId) throw UsageError('Grok inspection response identity does not match the registered resource.')
      return { state: 'available', sanitizedMetadata: entry.sanitizedMetadata }
    },
    deleteVoice: async voice => {
      const payload = record(await request({ method: 'DELETE', path: `/v1/custom-voices/${encodeURIComponent(voice.resourceId)}` }), 'custom voice deletion')
      if (payload['deleted'] !== true) throw UsageError('Grok custom voice deletion response did not confirm deletion.')
    },
    now,
  })

  return { provider: 'grok', accountScopeHash, getDeclaredCapabilities: () => GROK_ADVANCED_CAPABILITY_FIXTURE.records, catalog, clone, lifecycle }
}
