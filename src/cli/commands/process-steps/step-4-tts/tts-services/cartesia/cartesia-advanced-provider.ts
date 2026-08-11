import type {
  AnyCapabilityRecord,
  ProviderVoiceCatalogEntry,
  ProviderVoiceCatalogPage,
  ProviderVoiceCloneRequest,
  ProviderVoiceInspection,
  ProviderVoiceMutationResult,
  ProviderVoiceRef,
  TtsVoiceProvider,
  VoiceCatalogPort,
  VoiceClonePort,
  VoiceLifecyclePort,
} from '~/types'
import { CARTESIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { CLIUsageError } from '~/utils/error-handler'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  createAdvancedProviderJsonRequest,
  providerAccountScopeHash,
  type AdvancedProviderHttpRequest,
} from '../../script-to-audio/advanced-provider-contracts'

export const CARTESIA_API_VERSION = '2026-03-01'

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

type JsonRecord = Record<string, unknown>
const record = (value: unknown, label: string): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw CLIUsageError(`Cartesia ${label} response is invalid.`)
  return value as JsonRecord
}
const string = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined

const mapVoice = (value: unknown): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = string(voice['id'])
  const name = string(voice['name'])
  if (!resourceId || !name) throw CLIUsageError('Cartesia voice response omits id or name.')
  const isOwner = voice['is_owner'] === true
  const labels = Object.fromEntries([
    ['gender', string(voice['gender'])],
    ['language', string(voice['language'])],
    ['country', string(voice['country'])],
  ].flatMap(([key, item]) => item ? [[key as string, item]] : []))
  return {
    provider: 'cartesia', resourceId, name,
    source: isOwner ? 'account' : 'provider-library',
    origin: isOwner ? 'imported-custom' : 'provider-stock',
    ...(string(voice['preview_file_url']) ? { previewUrl: string(voice['preview_file_url']) } : {}),
    ...(string(voice['description']) ? { description: string(voice['description']) } : {}),
    labels, modelIds: [], state: 'available',
    sanitizedMetadata: {
      isOwner,
      ...(typeof voice['is_public'] === 'boolean' ? { isPublic: voice['is_public'] } : {}),
      ...(string(voice['created_at']) ? { createdAt: string(voice['created_at']) as string } : {})
    }
  }
}

export type CartesiaAdvancedProviderOptions = {
  apiKey: string
  request?: AdvancedProviderHttpRequest | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string }>) | undefined
  cloneLanguage?: string | undefined
  now?: (() => string) | undefined
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
      if (source === 'shared-library') throw CLIUsageError('Cartesia exposes public and account voices, not a shared-owner namespace.')
      const payload = record(await request({ method: 'GET', path: '/voices', query: {
        limit: '100',
        ...(input?.cursor ? { starting_after: input.cursor } : {}),
        is_owner: source === 'account' ? 'true' : 'false',
        'expand[]': 'preview_file_url'
      } }), 'voice catalog')
      const entries = Array.isArray(payload['data']) ? payload['data'].map(mapVoice) : []
      const nextCursor = payload['has_more'] === true ? string(payload['next_page']) : undefined
      const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'cartesia', entries, ...(nextCursor ? { nextCursor } : {}), checkedAt: now() }
      return page
    }
  }

  const clone: VoiceClonePort = {
    clone: async cloneRequest => {
      if (!cloneRequest.consentRecordRef || !cloneRequest.provenanceRef) throw CLIUsageError('Cartesia cloning requires consent and provenance before any external upload.')
      if (cloneRequest.cloneKind === 'professional') {
        const result: ProviderVoiceMutationResult = { schemaVersion: 1, provider: 'cartesia', state: 'external-action-required', action: 'Complete the gated Cartesia Pro Voice Clone workflow in the dashboard, then import its stable voice ID.', sanitizedMetadata: { cloneKind: 'professional', cloneChannel: 'cartesia-dashboard', sampleCount: cloneRequest.protectedSamples.length }, checkedAt: now() }
        return result
      }
      if (cloneRequest.protectedSamples.length !== 1) throw CLIUsageError('Cartesia Instant Voice Clone requires exactly one protected sample.')
      if (!options.resolveProtectedAsset) throw CLIUsageError('Cartesia cloning requires a protected-asset resolver.')
      if (!cloneRequest.desiredName.trim()) throw CLIUsageError('Cartesia cloning requires a voice name.')
      const language = options.cloneLanguage?.trim() || 'en'
      const resolved = await options.resolveProtectedAsset(cloneRequest.protectedSamples[0] as ProviderVoiceCloneRequest['protectedSamples'][number])
      const form = new FormData()
      form.append('clip', new Blob([resolved.bytes], { type: resolved.mediaType }), resolved.fileName)
      form.append('name', cloneRequest.desiredName)
      form.append('language', language)
      if (cloneRequest.description) form.append('description', cloneRequest.description)
      const entry = mapVoice(await request({ method: 'POST', path: '/voices/clone', body: form }) as unknown)
      const checkedAt = now()
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource', provider: 'cartesia', resourceId: entry.resourceId, namespace: 'account', accountScopeHash,
        origin: 'instant-clone', ownership: 'project', deletion: { state: 'eligible', checkedAt },
        derivedFrom: { sourceRef: cloneRequest.protectedSamples[0]!.assetId, sourceIdentityHash: cloneRequest.protectedSamples[0]!.sha256, operation: 'cloned-from', localAttemptId: cloneRequest.localAttemptId }
      }
      return { schemaVersion: 1, provider: 'cartesia', state: 'ready', providerVoice, sanitizedMetadata: { cloneKind: 'instant', sampleCount: 1, language }, checkedAt }
    }
  }

  const inspect = async (voice: ProviderVoiceRef): Promise<ProviderVoiceInspection> => {
    if (voice.provider !== 'cartesia' || voice.kind !== 'remote-resource') throw CLIUsageError('Cartesia inspection requires a Cartesia remote voice resource.')
    const entry = mapVoice(await request({ method: 'GET', path: `/voices/${encodeURIComponent(voice.resourceId)}`, query: { 'expand[]': 'preview_file_url' } }) as unknown)
    if (entry.resourceId !== voice.resourceId) throw CLIUsageError('Cartesia inspection response identity does not match the registered resource.')
    return { schemaVersion: 1, provider: 'cartesia', providerVoice: voice, state: 'available', deletion: voice.deletion, sanitizedMetadata: entry.sanitizedMetadata, checkedAt: now() }
  }
  const lifecycle: VoiceLifecyclePort = {
    inspect,
    delete: async deleteRequest => {
      const voice = deleteRequest.providerVoice
      if (voice.provider !== 'cartesia' || voice.kind !== 'remote-resource' || voice.resourceId !== deleteRequest.expectedResourceId) throw CLIUsageError('Cartesia deletion identity does not match the registered resource.')
      if (voice.ownership !== 'project' || voice.deletion.state !== 'eligible' || voice.namespace !== 'account') throw CLIUsageError('Cartesia deletes only eligibility-checked project-owned account voices.')
      if (voice.accountScopeHash !== accountScopeHash) throw CLIUsageError('Cartesia deletion credentials do not match the registered account scope.')
      await request({ method: 'DELETE', path: `/voices/${encodeURIComponent(voice.resourceId)}` })
      return { deletedAt: now() }
    }
  }

  return { provider: 'cartesia', accountScopeHash, getDeclaredCapabilities: () => CARTESIA_ADVANCED_CAPABILITY_FIXTURE.records, catalog, clone, lifecycle }
}
