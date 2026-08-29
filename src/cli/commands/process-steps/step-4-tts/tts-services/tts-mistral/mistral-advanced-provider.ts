import type {
  AnyCapabilityRecord,
  MistralAdvancedProviderOptions,
  ProviderVoiceCatalogEntry,
  ProviderVoiceCatalogPage,
  ProviderVoiceMutationResult,
  ProviderVoiceRef,
  TtsVoiceProvider,
  VoiceCatalogPort,
  VoiceClonePort,
  VoiceLifecyclePort,
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import { MISTRAL_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { mistralJsonRequest } from '~/utils/mistral/mistral-client'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { buildAdvancedCapabilityFixture, buildCapabilityDocumentationEvidence } from '../../script-to-audio/advanced-provider-contracts'
import { assertAdvancedVoiceCloneAuthorized } from '../advanced-voice-provider-shell'
import { createProviderRecordReader } from '../advanced-provider-json'
import { deleteMistralSavedVoice, inspectMistralSavedVoice, mistralAccountScopeHash, sanitizeMistralVoiceResponse } from '../../voice-management/mistral-voice-management'

const DOCS = 'https://docs.mistral.ai/studio/audio/text_to_speech/voices'
const evidence = buildCapabilityDocumentationEvidence([DOCS], '2026-08-29T00:00:00.000Z')
const capabilityRecords = [
  { scope: { provider: 'mistral', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence },
  { scope: { provider: 'mistral', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence },
  { scope: { provider: 'mistral', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence },
] as const satisfies readonly AnyCapabilityRecord[]

export const MISTRAL_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)
const record = createProviderRecordReader('Mistral')
const requestDefault: NonNullable<MistralAdvancedProviderOptions['request']> = async options => await mistralJsonRequest(options)

const mapVoice = (value: unknown, source: 'provider-library' | 'account'): ProviderVoiceCatalogEntry => {
  const { id, metadata } = sanitizeMistralVoiceResponse(value)
  return {
    provider: 'mistral', resourceId: id, name: String(metadata['name'] ?? id), source,
    origin: source === 'provider-library' ? 'provider-stock' : 'saved-reference', labels: {}, modelIds: ['voxtral-mini-tts-2603'], state: 'available',
    ...(typeof metadata['description'] === 'string' ? { description: metadata['description'] } : {}), sanitizedMetadata: metadata,
  }
}

export const createMistralAdvancedProvider = (options: MistralAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const request = options.request ?? requestDefault
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = mistralAccountScopeHash(options.apiKey)
  const requestVoice = async (path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: unknown): Promise<unknown> => await request({ apiKey: options.apiKey, baseURL: MISTRAL_DEFAULT_BASE_URL, path, method, ...(body === undefined ? {} : { body }), timeoutMs: MEDIA_GENERATION_TIMEOUT_MS, errorMessagePrefix: 'Mistral voice management failed' })

  const catalog: VoiceCatalogPort = {
    list: async input => {
      const source = input?.source ?? 'account'
      if (source === 'shared-library') throw UsageError('Mistral does not expose a shared-owner voice-library namespace.')
      const offset = input?.cursor === undefined ? 0 : Number(input.cursor)
      if (!Number.isInteger(offset) || offset < 0) throw UsageError('Mistral voice catalog cursor must be a non-negative offset.')
      const limit = 100
      const type = source === 'provider-library' ? 'preset' : 'custom'
      const payload = record(await requestVoice(`/audio/voices?limit=${limit}&offset=${offset}&type=${type}`), 'voice catalog')
      const items = Array.isArray(payload['items']) ? payload['items'] : []
      const entries = items.map(value => mapVoice(value, source))
      const total = typeof payload['total'] === 'number' && Number.isInteger(payload['total']) ? payload['total'] : undefined
      const nextOffset = offset + items.length
      const nextCursor = items.length > 0 && (total === undefined ? items.length === limit : nextOffset < total) ? String(nextOffset) : undefined
      const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'mistral', entries, ...(nextCursor ? { nextCursor } : {}), checkedAt: now() }
      return page
    }
  }

  const clone: VoiceClonePort = {
    clone: async cloneRequest => {
      assertAdvancedVoiceCloneAuthorized({ provider: 'mistral', label: 'Mistral', labelWithArticle: 'a Mistral', accountScopeHash }, cloneRequest, 'before any provider upload')
      if (cloneRequest.cloneKind !== 'instant') throw UsageError('Mistral does not expose a professional voice-clone API.')
      if (cloneRequest.protectedSamples.length !== 1) throw UsageError('Mistral saved-reference cloning requires exactly one protected sample.')
      if (!options.resolveProtectedAsset) throw UsageError('Mistral cloning requires a protected-asset resolver.')
      const sample = cloneRequest.protectedSamples[0]!
      const resolved = await options.resolveProtectedAsset(sample)
      if (resolved.bytes.byteLength === 0) throw UsageError('Mistral saved-reference sample cannot be empty.')
      const slug = `autoshow-${cloneRequest.localAttemptId.replace(/_/g, '-').slice(0, 100)}`
      const payload = await requestVoice('/audio/voices', 'POST', { name: cloneRequest.desiredName, slug, sample_audio: Buffer.from(resolved.bytes).toString('base64'), sample_filename: resolved.fileName })
      const { id, metadata } = sanitizeMistralVoiceResponse(payload)
      const checkedAt = now()
      const providerVoice: ProviderVoiceRef = { kind: 'remote-resource', provider: 'mistral', resourceId: id, namespace: 'account', accountScopeHash, origin: 'saved-reference', ownership: 'project', deletion: { state: 'eligible', checkedAt }, derivedFrom: { sourceRef: sample.assetId, sourceIdentityHash: sample.sha256, operation: 'cloned-from', localAttemptId: cloneRequest.localAttemptId } }
      const result: ProviderVoiceMutationResult = { schemaVersion: 1, provider: 'mistral', state: 'ready', providerVoice, sanitizedMetadata: { ...metadata, slug }, checkedAt }
      return result
    }
  }

  const lifecycle: VoiceLifecyclePort = {
    inspect: async voice => {
      if (voice.provider !== 'mistral' || voice.kind !== 'remote-resource') throw UsageError('Mistral inspection requires a Mistral remote voice resource.')
      const observed = await inspectMistralSavedVoice({ apiKey: options.apiKey, voiceId: voice.resourceId, request })
      return { schemaVersion: 1, provider: 'mistral', providerVoice: voice, state: 'available', deletion: voice.deletion, sanitizedMetadata: observed.sanitizedMetadata, checkedAt: observed.observedAt }
    },
    delete: async deleteRequest => {
      if (deleteRequest.providerVoice.kind !== 'remote-resource') throw UsageError('Mistral deletion requires a remote voice resource.')
      const deleted = await deleteMistralSavedVoice({ apiKey: options.apiKey, providerVoice: deleteRequest.providerVoice, confirmResourceId: deleteRequest.expectedResourceId, request })
      return { deletedAt: deleted.deletedAt }
    }
  }

  return { provider: 'mistral', accountScopeHash, getDeclaredCapabilities: () => MISTRAL_ADVANCED_CAPABILITY_FIXTURE.records, catalog, clone, lifecycle }
}
