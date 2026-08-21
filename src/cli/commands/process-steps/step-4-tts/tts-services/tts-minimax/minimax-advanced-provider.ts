import type {
  AnyCapabilityRecord,
  JsonObject,
  MiniMaxAdvancedProviderOptions,
  MiniMaxVoiceType,
  ProviderVoiceCatalogEntry,
  ProviderVoiceCatalogPage,
  ProviderVoiceCloneRequest,
  ProviderVoiceDesignResult,
  ProviderVoiceInspection,
  ProviderVoiceMutationResult,
  ProviderVoiceRef,
  TtsVoiceProvider,
  VoiceCatalogPort,
  VoiceClonePort,
  VoiceDesignPort,
  VoiceLifecyclePort,
} from '~/types'
import { MINIMAX_DEFAULT_BASE_URL } from '~/utils/base-urls'
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
import { assertAdvancedVoiceCloneAuthorized, assertAdvancedVoiceDeletable, assertAdvancedVoiceInspectionIdentity, buildAdvancedVoiceInspection } from '../advanced-voice-provider-shell'

const DOCS = {
  catalog: 'https://platform.minimax.io/docs/api-reference/voice-management-get',
  design: 'https://platform.minimax.io/docs/api-reference/voice-design-design',
  clone: 'https://platform.minimax.io/docs/api-reference/voice-cloning-clone',
  upload: 'https://platform.minimax.io/docs/api-reference/voice-cloning-uploadcloneaudio',
  delete: 'https://platform.minimax.io/docs/api-reference/voice-management-delete',
  synthesis: 'https://platform.minimax.io/docs/api-reference/speech-t2a-http',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const unsupported = 'MiniMax speech requests select one voice_id; the documented API does not expose a native multi-speaker dialogue request.'
const capabilityRecords = [
  { scope: { provider: 'minimax', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], maxCharacters: 10000, supportedOutputFormats: ['mp3', 'pcm', 'flac', 'wav'] }, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'minimax', feature: 'native-dialogue' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 2 }, reason: unsupported, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'minimax', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: false, stableResourceIds: true }, documentationEvidence: evidence([DOCS.catalog]) },
  { scope: { provider: 'minimax', feature: 'voice-design' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.design]) },
  { scope: { provider: 'minimax', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [{ kind: 'plan' as const }], constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.upload, DOCS.clone]) },
  { scope: { provider: 'minimax', feature: 'professional-clone' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, reason: 'The documented MiniMax API exposes one voice-cloning workflow, not a separate professional-clone API facet.', documentationEvidence: evidence([DOCS.clone]) },
  { scope: { provider: 'minimax', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.delete]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const MINIMAX_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)
const MINIMAX_TEMPORARY_VOICE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
const MINIMAX_CLONE_SAMPLE_MAX_BYTES = 20 * 1024 * 1024

const record = createProviderRecordReader('MiniMax')
const integer = (value: unknown): number | undefined => typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
const strings = (value: unknown): string[] => Array.isArray(value) ? value.flatMap(item => trimmedString(item) ?? []) : []
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : []

const assertBaseResponse = (payload: JsonObject, label: string): JsonObject => {
  const baseResponse = payload['base_resp']
  if (!baseResponse || typeof baseResponse !== 'object' || Array.isArray(baseResponse)) return payload
  const statusCode = (baseResponse as JsonObject)['status_code']
  if (statusCode !== undefined && statusCode !== 0) throw CLIUsageError(`MiniMax ${label} failed: ${trimmedString((baseResponse as JsonObject)['status_msg']) ?? `status ${String(statusCode)}`}.`)
  return payload
}

const plusLifetime = (iso: string): string => new Date(Date.parse(iso) + MINIMAX_TEMPORARY_VOICE_LIFETIME_MS).toISOString()

const mapVoice = (
  value: unknown,
  voiceType: 'system' | MiniMaxVoiceType,
  checkedAt: string
): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = trimmedString(voice['voice_id'])
  if (!resourceId) throw CLIUsageError('MiniMax voice response omits voice_id.')
  const source = voiceType === 'system' ? 'provider-library' as const : 'account' as const
  const origin = voiceType === 'system' ? 'provider-stock' as const : voiceType === 'voice_generation' ? 'designed' as const : 'instant-clone' as const
  const description = strings(voice['description']).join(', ') || trimmedString(voice['description'])
  return {
    provider: 'minimax',
    resourceId,
    name: trimmedString(voice['voice_name']) ?? resourceId,
    source,
    origin,
    ...(description ? { description } : {}),
    labels: {},
    modelIds: [],
    state: 'available',
    sanitizedMetadata: {
      voiceType,
      ...(trimmedString(voice['created_time']) ? { createdTime: trimmedString(voice['created_time']) as string } : {}),
      ...(voiceType === 'system' ? {} : { activationRequiredBeforeCatalogVisibility: true, temporaryLifetimeDays: 7, observedAt: checkedAt })
    }
  }
}

const voiceTypeFor = (voice: Extract<ProviderVoiceRef, { kind: 'remote-resource' }>): MiniMaxVoiceType =>
  voice.origin === 'designed' ? 'voice_generation' : 'voice_cloning'

export const createMiniMaxAdvancedProvider = (options: MiniMaxAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & {
  accountScopeHash: string
} => {
  const request = options.request ?? createAdvancedProviderJsonRequest({ baseUrl: MINIMAX_DEFAULT_BASE_URL, apiKey: `Bearer ${options.apiKey}`, apiKeyHeader: 'Authorization', providerLabel: 'MiniMax' })
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('minimax', options.apiKey)

  const getVoices = async (voiceType: 'system' | 'all'): Promise<JsonObject> => assertBaseResponse(record(await request({ method: 'POST', path: '/v1/get_voice', body: { voice_type: voiceType } }), 'voice catalog'), 'voice catalog')
  const catalog: VoiceCatalogPort = {
    list: async input => {
      const source = input?.source ?? 'account'
      if (source === 'shared-library') throw CLIUsageError('MiniMax does not expose a shared-owner voice-library namespace.')
      if (input?.cursor) throw CLIUsageError('MiniMax voice catalog is not paginated and does not accept a cursor.')
      const checkedAt = now()
      const payload = await getVoices(source === 'provider-library' ? 'system' : 'all')
      const entries = source === 'provider-library'
        ? array(payload['system_voice']).map(value => mapVoice(value, 'system', checkedAt))
        : [
            ...array(payload['voice_cloning']).map(value => mapVoice(value, 'voice_cloning', checkedAt)),
            ...array(payload['voice_generation']).map(value => mapVoice(value, 'voice_generation', checkedAt)),
          ]
      const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'minimax', entries, checkedAt }
      return page
    }
  }

  const design: VoiceDesignPort = {
    createCandidate: async designRequest => {
      if (designRequest.sourceVoice) throw CLIUsageError('MiniMax does not expose a voice remix operation.')
      if (designRequest.candidateCount !== 1) throw CLIUsageError('MiniMax Voice Design returns exactly one bounded preview per request.')
      if (!designRequest.description.trim()) throw CLIUsageError('MiniMax Voice Design prompt cannot be blank.')
      if (!designRequest.previewText.trim() || designRequest.previewText.length > 500) throw CLIUsageError('MiniMax Voice Design preview text must contain 1-500 characters.')
      if (designRequest.seed !== undefined) throw CLIUsageError('MiniMax Voice Design does not expose a deterministic seed.')
      const checkedAt = now()
      const payload = assertBaseResponse(record(await request({ method: 'POST', path: '/v1/voice_design', body: { prompt: designRequest.description, preview_text: designRequest.previewText } }), 'voice design'), 'voice design')
      const providerCandidateId = trimmedString(payload['voice_id'])
      const trialAudio = trimmedString(payload['trial_audio'])
      if (!providerCandidateId || !trialAudio || !/^(?:[a-fA-F0-9]{2})+$/.test(trialAudio)) throw CLIUsageError('MiniMax Voice Design response omits a valid voice_id or hexadecimal trial_audio.')
      const result: ProviderVoiceDesignResult = {
        schemaVersion: 1,
        provider: 'minimax',
        operation: 'design',
        creationModel: designRequest.creationModel,
        previews: [{
          providerCandidateId,
          audioBase64: Buffer.from(trialAudio, 'hex').toString('base64'),
          mediaType: 'audio/mpeg',
          expiresAt: plusLifetime(checkedAt),
          sanitizedMetadata: { activationRequired: true, temporaryLifetimeDays: 7 }
        }],
        checkedAt
      }
      return result
    },
    materializeCandidate: async materializeRequest => {
      if (!materializeRequest.providerCandidateId.trim() || !materializeRequest.desiredName.trim()) throw CLIUsageError('MiniMax materialization requires the selected candidate ID and desired local name.')
      const checkedAt = now()
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource', provider: 'minimax', resourceId: materializeRequest.providerCandidateId,
        namespace: 'account', accountScopeHash, origin: 'designed', ownership: 'project', expiresAt: plusLifetime(checkedAt),
        deletion: { state: 'eligible', checkedAt },
        derivedFrom: {
          sourceRef: materializeRequest.providerCandidateId,
          sourceIdentityHash: hashCanonicalTtsValue({ provider: 'minimax', candidateId: materializeRequest.providerCandidateId }),
          operation: 'designed-from', localAttemptId: materializeRequest.localAttemptId, providerOperationId: materializeRequest.providerCandidateId
        }
      }
      return { schemaVersion: 1, provider: 'minimax', state: 'ready', providerVoice, sanitizedMetadata: { activationRequired: true, temporaryLifetimeDays: 7, desiredName: materializeRequest.desiredName }, checkedAt }
    }
  }

  const clone: VoiceClonePort = {
    clone: async cloneRequest => {
      assertAdvancedVoiceCloneAuthorized(identity, cloneRequest, 'before any external upload')
      if (cloneRequest.cloneKind === 'professional') {
        const result: ProviderVoiceMutationResult = { schemaVersion: 1, provider: 'minimax', state: 'external-action-required', action: 'MiniMax does not document a separate professional-clone API; use the supported instant clone or manage any contracted workflow externally.', sanitizedMetadata: { cloneKind: 'professional', sampleCount: cloneRequest.protectedSamples.length }, checkedAt: now() }
        return result
      }
      if (cloneRequest.protectedSamples.length !== 1) throw CLIUsageError('MiniMax Voice Clone requires exactly one protected sample.')
      if (!options.resolveProtectedAsset) throw CLIUsageError('MiniMax cloning requires a protected-asset resolver.')
      if (!/^[A-Za-z](?:[A-Za-z0-9_-]{6,254}[A-Za-z0-9])$/.test(cloneRequest.desiredName)) throw CLIUsageError('MiniMax clone voice ID must contain 8-256 letters, numbers, underscores, or hyphens, start with a letter, and end with a letter or number.')
      const resolved = await options.resolveProtectedAsset(cloneRequest.protectedSamples[0] as ProviderVoiceCloneRequest['protectedSamples'][number])
      if (resolved.bytes.byteLength === 0 || resolved.bytes.byteLength > MINIMAX_CLONE_SAMPLE_MAX_BYTES) throw CLIUsageError('MiniMax clone sample must be non-empty and no larger than 20 MiB.')
      if (!Number.isFinite(resolved.durationMs) || resolved.durationMs < 10_000 || resolved.durationMs > 300_000) throw CLIUsageError('MiniMax clone sample must have a verified duration from 10 seconds through 5 minutes.')
      if (!/\.(?:mp3|m4a|wav)$/i.test(resolved.fileName)) throw CLIUsageError('MiniMax clone sample must be an mp3, m4a, or wav file.')
      const form = new FormData()
      form.append('purpose', 'voice_clone')
      form.append('file', new Blob([resolved.bytes], { type: resolved.mediaType }), resolved.fileName)
      const uploaded = assertBaseResponse(record(await request({ method: 'POST', path: '/v1/files/upload', body: form }), 'clone sample upload'), 'clone sample upload')
      const file = uploaded['file'] && typeof uploaded['file'] === 'object' && !Array.isArray(uploaded['file']) ? uploaded['file'] as JsonObject : uploaded
      const fileId = integer(file['file_id']) ?? integer(file['id'])
      if (fileId === undefined) throw CLIUsageError('MiniMax clone sample upload returned no positive integer file_id.')
      const checkedAt = now()
      const cloned = assertBaseResponse(record(await request({ method: 'POST', path: '/v1/voice_clone', body: { file_id: fileId, voice_id: cloneRequest.desiredName } }), 'voice clone'), 'voice clone')
      const resourceId = trimmedString(cloned['voice_id']) ?? cloneRequest.desiredName
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource', provider: 'minimax', resourceId, namespace: 'account', accountScopeHash,
        origin: 'instant-clone', ownership: 'project', expiresAt: plusLifetime(checkedAt), deletion: { state: 'eligible', checkedAt },
        derivedFrom: {
          sourceRef: cloneRequest.protectedSamples[0]!.assetId,
          sourceIdentityHash: cloneRequest.protectedSamples[0]!.sha256,
          operation: 'cloned-from', localAttemptId: cloneRequest.localAttemptId,
          ...(trimmedString(cloned['trace_id']) ? { providerOperationId: trimmedString(cloned['trace_id']) } : {})
        }
      }
      return { schemaVersion: 1, provider: 'minimax', state: 'ready', providerVoice, sanitizedMetadata: { cloneKind: 'instant', sampleCount: 1, sampleDurationMs: resolved.durationMs, activationRequired: true, temporaryLifetimeDays: 7 }, checkedAt }
    }
  }

  const identity: AdvancedVoiceProviderIdentity = { provider: 'minimax', label: 'MiniMax', labelWithArticle: 'a MiniMax', accountScopeHash }
  const inspect = async (voice: ProviderVoiceRef): Promise<ProviderVoiceInspection> => {
    const remote = assertAdvancedVoiceInspectionIdentity(identity, voice)
    const page = await catalog.list({ source: remote.namespace === 'account' ? 'account' : 'provider-library' })
    const entry = page.entries.find(candidate => candidate.resourceId === remote.resourceId)
    // A MiniMax clone stays invisible to the catalog until it is activated, so a missing
    // entry with a live expiry is pending rather than gone.
    const expired = remote.expiresAt !== undefined && Date.parse(remote.expiresAt) <= Date.parse(page.checkedAt)
    return buildAdvancedVoiceInspection(identity, {
      voice: remote,
      state: entry ? 'available' : expired ? 'expired' : remote.expiresAt ? 'pending' : 'missing',
      sanitizedMetadata: entry?.sanitizedMetadata ?? { activationRequiredBeforeCatalogVisibility: Boolean(remote.expiresAt) },
      checkedAt: page.checkedAt
    })
  }
  const lifecycle: VoiceLifecyclePort = {
    inspect,
    delete: async deleteRequest => {
      const voice = assertAdvancedVoiceDeletable(identity, { ownedResourceLabel: 'account voices' }, deleteRequest)
      const payload = assertBaseResponse(record(await request({ method: 'POST', path: '/v1/delete_voice', body: { voice_type: voiceTypeFor(voice), voice_id: voice.resourceId } }), 'voice deletion'), 'voice deletion')
      const returnedId = trimmedString(payload['voice_id'])
      if (returnedId && returnedId !== voice.resourceId) throw CLIUsageError('MiniMax deletion response identity does not match the registered resource.')
      return { deletedAt: now() }
    }
  }

  return { provider: 'minimax', accountScopeHash, getDeclaredCapabilities: () => MINIMAX_ADVANCED_CAPABILITY_FIXTURE.records, catalog, design, clone, lifecycle }
}
