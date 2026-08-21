import type {
  AnyCapabilityRecord,
  ElevenLabsAdvancedProviderOptions,
  JsonObject,
  ProviderVoiceCatalogEntry,
  ProviderVoiceCatalogPage,
  ProviderVoiceDesignResult,
  ProviderVoiceRef,
  TtsVoiceProvider,
  VoiceCatalogPort,
  VoiceClonePort,
  VoiceDesignPort,
} from '~/types'
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

const DOCS = {
  voices: 'https://elevenlabs.io/docs/api-reference/voices/search',
  sharedVoices: 'https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared',
  inspect: 'https://elevenlabs.io/docs/api-reference/voices/get',
  design: 'https://elevenlabs.io/docs/api-reference/text-to-voice/design',
  remix: 'https://elevenlabs.io/docs/api-reference/text-to-voice/remix',
  create: 'https://elevenlabs.io/docs/api-reference/text-to-voice/create',
  clone: 'https://elevenlabs.io/docs/api-reference/voices/ivc/create',
  delete: 'https://elevenlabs.io/docs/api-reference/voices/delete',
  dialogue: 'https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps',
  defaults: 'https://elevenlabs.io/docs/overview/capabilities/voices',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const requirementPlan = [{ kind: 'plan' as const }]
const requirementVerification = [{ kind: 'verification' as const, verificationKind: 'professional-voice-clone' }]

const capabilityRecords = [
  { scope: { provider: 'elevenlabs', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['mp3', 'pcm', 'wav', 'ulaw', 'alaw', 'opus'] }, documentationEvidence: evidence([DOCS.dialogue]) },
  { scope: { provider: 'elevenlabs', feature: 'native-dialogue' as const, model: 'eleven_v3', transport: 'hosted-api' }, maturity: 'preview' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], maxCharacters: 2000, supportedOutputFormats: ['mp3', 'pcm', 'wav', 'ulaw', 'alaw', 'opus'], minSpeakers: 1, maxSpeakers: 10 }, documentationEvidence: evidence([DOCS.dialogue]) },
  { scope: { provider: 'elevenlabs', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence([DOCS.voices, DOCS.sharedVoices, DOCS.defaults]) },
  { scope: { provider: 'elevenlabs', feature: 'voice-design' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.design, DOCS.create]) },
  { scope: { provider: 'elevenlabs', feature: 'voice-remix' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.remix, DOCS.create]) },
  { scope: { provider: 'elevenlabs', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: requirementPlan, constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.clone]) },
  { scope: { provider: 'elevenlabs', feature: 'professional-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [...requirementPlan, ...requirementVerification], constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.clone]) },
  { scope: { provider: 'elevenlabs', feature: 'voice-import' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.voices]) },
  { scope: { provider: 'elevenlabs', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.delete]) },
  { scope: { provider: 'elevenlabs', feature: 'word-timing' as const, model: 'eleven_v3', transport: 'hosted-api' }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { providerTimeUnit: 'seconds', providerIndexUnit: 'provider-character-array-index' as const }, documentationEvidence: evidence([DOCS.dialogue]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)
export const ELEVENLABS_DEFAULT_VOICE_EXPIRY = '2026-12-31T23:59:59.999Z'

const record = createProviderRecordReader('ElevenLabs')
const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.flatMap(item => trimmedString(item) ?? []) : []
const labels = (value: unknown): Record<string, string> => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).flatMap(([key, item]) => typeof item === 'string' ? [[key, item]] : []))
  : {}

const unixExpiry = (value: unknown): string | undefined => typeof value === 'number' && Number.isFinite(value) && value > 0
  ? new Date(value * 1000).toISOString()
  : undefined

const mapVoice = (value: unknown, source: ProviderVoiceCatalogEntry['source']): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = trimmedString(voice['voice_id']) ?? trimmedString(voice['id'])
  const name = trimmedString(voice['name'])
  if (!resourceId || !name) throw CLIUsageError('ElevenLabs voice response omits voice_id or name.')
  const category = trimmedString(voice['category'])
  const sharing = voice['sharing'] && typeof voice['sharing'] === 'object' && !Array.isArray(voice['sharing']) ? voice['sharing'] as JsonObject : undefined
  const expiresAt = unixExpiry(sharing?.['disable_at_unix'])
    ?? (category === 'premade' && voice['is_legacy'] === true ? ELEVENLABS_DEFAULT_VOICE_EXPIRY : undefined)
  const fineTuning = voice['fine_tuning'] && typeof voice['fine_tuning'] === 'object' && !Array.isArray(voice['fine_tuning']) ? voice['fine_tuning'] as JsonObject : undefined
  const fineState = fineTuning?.['state'] && typeof fineTuning['state'] === 'object' && !Array.isArray(fineTuning['state'])
    ? Object.values(fineTuning['state'] as JsonObject).map(item => trimmedString(item)).filter(Boolean)
    : []
  const requiresVerification = fineState.some(state => state === 'not_verified' || state === 'not_started')
  const origin = source === 'shared-library'
    ? 'community-library' as const
    : category === 'generated'
      ? 'designed' as const
      : category === 'cloned'
        ? 'instant-clone' as const
        : source === 'account'
          ? 'imported-custom' as const
          : 'provider-stock' as const
  return {
    provider: 'elevenlabs',
    resourceId,
    name,
    source,
    origin,
    ...(trimmedString(voice['preview_url']) ? { previewUrl: trimmedString(voice['preview_url']) } : {}),
    ...(trimmedString(voice['description']) ? { description: trimmedString(voice['description']) } : {}),
    labels: labels(voice['labels']),
    modelIds: stringArray(voice['high_quality_base_model_ids']),
    state: expiresAt && Date.parse(expiresAt) <= Date.now()
      ? 'expired'
      : requiresVerification ? 'verification-required' : 'available',
    ...(expiresAt ? { expiresAt } : {}),
    sanitizedMetadata: {
      ...(category ? { category } : {}),
      ...(trimmedString(voice['public_owner_id']) ? { publicOwnerId: trimmedString(voice['public_owner_id']) as string } : {}),
      ...(typeof voice['is_owner'] === 'boolean' ? { isOwner: voice['is_owner'] } : {}),
      ...(typeof sharing?.['notice_period'] === 'number' ? { noticePeriodDays: sharing['notice_period'] } : {}),
      defaultVoiceExpiryRecognized: ELEVENLABS_DEFAULT_VOICE_EXPIRY,
    }
  }
}

export const createElevenLabsAdvancedProvider = (options: ElevenLabsAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & {
  accountScopeHash: string
} => {
  const request = options.request ?? createAdvancedProviderJsonRequest({ baseUrl: 'https://api.elevenlabs.io', apiKey: options.apiKey, apiKeyHeader: 'xi-api-key', providerLabel: 'ElevenLabs' })
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('elevenlabs', options.apiKey)

  const catalog: VoiceCatalogPort = {
    list: async input => {
      const source = input?.source ?? 'account'
      const response = record(await request(source === 'shared-library'
        ? { method: 'GET', path: '/v1/shared-voices', query: { page_size: '100', ...(input?.cursor ? { last_sort_id: input.cursor } : {}) } }
        : { method: 'GET', path: '/v2/voices', query: { next_page_token: input?.cursor, page_size: '100', include_total_count: 'false' } }), 'catalog')
      const voices = Array.isArray(response['voices']) ? response['voices'] : []
      const nextCursor = trimmedString(response['next_page_token']) ?? (response['has_more'] === true ? trimmedString(response['last_sort_id']) : undefined)
      const page: ProviderVoiceCatalogPage = {
        schemaVersion: 1,
        provider: 'elevenlabs',
        entries: voices.map(voice => mapVoice(voice, source)),
        ...(nextCursor ? { nextCursor } : {}),
        checkedAt: now()
      }
      return page
    }
  }

  const design: VoiceDesignPort = {
    createCandidate: async designRequest => {
      if (designRequest.candidateCount < 1 || designRequest.candidateCount > 3) throw CLIUsageError('ElevenLabs Voice Design supports one to three bounded previews per operation.')
      if (designRequest.description.length < 20 || designRequest.description.length > 1000) throw CLIUsageError('ElevenLabs Voice Design description must contain 20-1000 characters.')
      if (designRequest.previewText.length < 100 || designRequest.previewText.length > 1000) throw CLIUsageError('ElevenLabs Voice Design preview text must contain 100-1000 characters.')
      const sourceVoice = designRequest.sourceVoice
      if (sourceVoice && (!designRequest.eligibilitySnapshotHash || !/^[a-f0-9]{64}$/.test(designRequest.eligibilitySnapshotHash))) {
        throw CLIUsageError('ElevenLabs remix requires a dated eligibility snapshot hash before any provider call.')
      }
      if (sourceVoice && sourceVoice.kind !== 'remote-resource') throw CLIUsageError('ElevenLabs remix requires a stable remote source voice ID.')
      const path = sourceVoice ? `/v1/text-to-voice/${encodeURIComponent(sourceVoice.resourceId)}/remix` : '/v1/text-to-voice/design'
      const response = record(await request({ method: 'POST', path, body: {
        voice_description: designRequest.description,
        text: designRequest.previewText,
        model_id: designRequest.creationModel,
        ...(typeof designRequest.seed === 'number' ? { seed: designRequest.seed } : {})
      } }), sourceVoice ? 'remix' : 'design')
      const previews = Array.isArray(response['previews']) ? response['previews'].slice(0, designRequest.candidateCount) : []
      if (previews.length === 0) throw CLIUsageError('ElevenLabs Voice Design returned no candidates.')
      const result: ProviderVoiceDesignResult = {
        schemaVersion: 1,
        provider: 'elevenlabs',
        operation: sourceVoice ? 'remix' : 'design',
        creationModel: designRequest.creationModel,
        previews: previews.map((value) => {
          const preview = record(value, 'voice preview')
          const providerCandidateId = trimmedString(preview['generated_voice_id'])
          const audioBase64 = trimmedString(preview['audio_base_64'])
          if (!providerCandidateId || !audioBase64) throw CLIUsageError('ElevenLabs voice preview omits generated voice ID or audio.')
          return {
            providerCandidateId,
            audioBase64,
            mediaType: trimmedString(preview['media_type']) ?? 'audio/mpeg',
            ...(typeof preview['duration_secs'] === 'number' ? { durationMs: Math.round(preview['duration_secs'] * 1000) } : {}),
            sanitizedMetadata: {
              ...(trimmedString(preview['language']) ? { language: trimmedString(preview['language']) as string } : {}),
              expiryState: 'not-exposed'
            }
          }
        }),
        checkedAt: now()
      }
      return result
    },
    materializeCandidate: async materializeRequest => {
      if (!materializeRequest.providerCandidateId.trim() || !materializeRequest.desiredName.trim()) throw CLIUsageError('ElevenLabs materialization requires the selected candidate ID and desired name.')
      if (materializeRequest.sourceVoice && !materializeRequest.eligibilitySnapshotHash) throw CLIUsageError('ElevenLabs remix materialization requires its eligibility snapshot.')
      const response = record(await request({ method: 'POST', path: '/v1/text-to-voice', body: {
        voice_name: materializeRequest.desiredName,
        voice_description: 'AutoShow materialized voice candidate',
        generated_voice_id: materializeRequest.providerCandidateId
      } }), 'voice materialization')
      const resourceId = trimmedString(response['voice_id'])
      if (!resourceId) throw CLIUsageError('ElevenLabs materialization returned no voice_id.')
      const derivedFrom = materializeRequest.sourceVoice
        ? {
            sourceRef: materializeRequest.sourceVoice.kind === 'remote-resource' ? materializeRequest.sourceVoice.resourceId : materializeRequest.providerCandidateId,
            sourceIdentityHash: hashCanonicalTtsValue(materializeRequest.sourceVoice),
            operation: 'remixed-from' as const,
            localAttemptId: materializeRequest.localAttemptId,
            eligibilitySnapshotHash: materializeRequest.eligibilitySnapshotHash
          }
        : undefined
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource', provider: 'elevenlabs', resourceId, namespace: 'account', accountScopeHash,
        origin: materializeRequest.sourceVoice ? 'remixed' : 'designed', ownership: 'project',
        ...(derivedFrom ? { derivedFrom } : {}), deletion: { state: 'eligible', checkedAt: now() }
      }
      return { schemaVersion: 1, provider: 'elevenlabs', state: 'ready', providerVoice, sanitizedMetadata: { materialization: 'text-to-voice' }, checkedAt: now() }
    }
  }

  const clone: VoiceClonePort = {
    clone: async cloneRequest => {
      assertAdvancedVoiceCloneAuthorized(identity, cloneRequest, 'references before any provider or external action')
      if (cloneRequest.cloneKind === 'professional') {
        return { schemaVersion: 1, provider: 'elevenlabs', state: 'verification-required', action: 'Complete Professional Voice Clone verification and plan checks, then import the resulting voice ID.', sanitizedMetadata: { cloneKind: 'professional' }, checkedAt: now() }
      }
      if (cloneRequest.protectedSamples.length === 0 || !options.resolveProtectedAsset) throw CLIUsageError('ElevenLabs Instant Voice Clone requires protected samples and a protected-asset resolver.')
      const form = new FormData()
      form.set('name', cloneRequest.desiredName)
      if (cloneRequest.description) form.set('description', cloneRequest.description)
      for (const sample of cloneRequest.protectedSamples) {
        const resolved = await options.resolveProtectedAsset(sample)
        form.append('files', new Blob([resolved.bytes], { type: resolved.mediaType }), resolved.fileName)
      }
      const response = record(await request({ method: 'POST', path: '/v1/voices/add', body: form }), 'instant clone')
      const resourceId = trimmedString(response['voice_id'])
      const providerOperationId = trimmedString(response['request_id'])
      if (!resourceId) {
        if (!providerOperationId) throw CLIUsageError('ElevenLabs Instant Voice Clone returned neither voice_id nor a pending operation ID.')
        return { schemaVersion: 1, provider: 'elevenlabs', state: 'pending', providerOperationId, sanitizedMetadata: { cloneKind: 'instant', sampleCount: cloneRequest.protectedSamples.length }, checkedAt: now() }
      }
      const providerVoice: ProviderVoiceRef = {
        kind: 'remote-resource', provider: 'elevenlabs', resourceId, namespace: 'account', accountScopeHash,
        origin: 'instant-clone', ownership: 'project', deletion: { state: 'eligible', checkedAt: now() }
      }
      const requiresVerification = response['requires_verification'] === true
      return {
        schemaVersion: 1,
        provider: 'elevenlabs',
        state: requiresVerification ? 'verification-required' : 'ready',
        providerVoice,
        ...(providerOperationId ? { providerOperationId } : {}),
        ...(requiresVerification ? { action: 'Complete ElevenLabs voice verification before audition or synthesis.' } : {}),
        sanitizedMetadata: { cloneKind: 'instant', sampleCount: cloneRequest.protectedSamples.length },
        checkedAt: now()
      }
    }
  }

  const identity: AdvancedVoiceProviderIdentity = { provider: 'elevenlabs', label: 'ElevenLabs', labelWithArticle: 'an ElevenLabs', accountScopeHash }
  const lifecycle = createRemoteResourceVoiceLifecycle(identity, { ownedResourceLabel: 'account resources', namespaceCheck: 'account-scope' }, {
    fetchVoice: async voice => {
      const entry = mapVoice(await request({ method: 'GET', path: `/v1/voices/${encodeURIComponent(voice.resourceId)}` }), voice.namespace === 'account' ? 'account' : 'provider-library')
      return { state: entry.state === 'unavailable' ? 'missing' : entry.state, sanitizedMetadata: entry.sanitizedMetadata }
    },
    deleteVoice: async voice => {
      await request({ method: 'DELETE', path: `/v1/voices/${encodeURIComponent(voice.resourceId)}` })
    },
    now
  })

  return {
    provider: 'elevenlabs',
    accountScopeHash,
    getDeclaredCapabilities: () => ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE.records,
    catalog,
    design,
    clone,
    lifecycle,
  }
}
