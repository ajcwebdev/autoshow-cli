import type { AnyCapabilityRecord, CreateDeepinfraAdvancedProviderOptions, DeepinfraDesignSynthesis, ProviderVoiceCatalogEntry, ProviderVoiceCatalogPage, ProviderVoiceCloneRequest, ProviderVoiceDesignResult, ProviderVoiceInspection, ProviderVoiceRef, TtsVoiceProvider, VoiceCatalogPort, VoiceClonePort, VoiceDesignPort, VoiceLifecyclePort } from '~/types'
import { CLIUsageError, ProviderError, ValidationError } from '~/utils/error-handler'
import { extractRestErrorMessage, parseJsonOrText, readRestResponseText } from '~/utils/rest-client'
import { isRetryableStatus } from '~/utils/retries'
import { hashCanonicalTtsValue } from '../../script-to-audio/contract-identity'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  createAdvancedProviderJsonRequest,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'
import {
  buildDeepinfraTtsRequestBody,
  decodeDeepinfraTtsAudio,
  DEEPINFRA_VOICE_CLONE_MODELS,
  isDeepinfraVoiceDesignModel,
} from './deepinfra-tts-request'
import { createProviderRecordReader, trimmedString } from '../advanced-provider-json'

const DOCS = {
  api: 'https://docs.deepinfra.com/apis/text-to-speech',
  models: 'https://deepinfra.com/models/text-to-speech',
  catalog: 'https://docs.deepinfra.com/api-reference/text-to-speech/get-voices',
  inspect: 'https://docs.deepinfra.com/api-reference/text-to-speech/get-voice',
  create: 'https://docs.deepinfra.com/api-reference/text-to-speech/create-voice',
  delete: 'https://docs.deepinfra.com/api-reference/text-to-speech/delete-voice',
  mimoDesign: 'https://deepinfra.com/XiaomiMiMo/MiMo-V2.5-tts-voicedesign',
  qwenDesign: 'https://deepinfra.com/Qwen/Qwen3-TTS-VoiceDesign',
  qwenTts: 'https://deepinfra.com/Qwen/Qwen3-TTS',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const capabilityRecords = [
  { scope: { provider: 'deepinfra', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['wav'] }, documentationEvidence: evidence([DOCS.api, DOCS.models]) },
  { scope: { provider: 'deepinfra', feature: 'native-dialogue' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 2 }, reason: 'The adapter sends one voice or voice_id per inference request and does not implement a native multi-speaker request.', documentationEvidence: evidence([DOCS.api]) },
  { scope: { provider: 'deepinfra', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: false, stableResourceIds: true }, documentationEvidence: evidence([DOCS.catalog, DOCS.inspect]) },
  { scope: { provider: 'deepinfra', feature: 'voice-design' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: false }, documentationEvidence: evidence([DOCS.mimoDesign, DOCS.qwenDesign]) },
  { scope: { provider: 'deepinfra', feature: 'instant-clone' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, documentationEvidence: evidence([DOCS.create, DOCS.qwenTts]) },
  { scope: { provider: 'deepinfra', feature: 'voice-import' as const }, maturity: 'stable' as const, channel: 'external-import' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: false }, documentationEvidence: evidence([DOCS.catalog, DOCS.inspect]) },
  { scope: { provider: 'deepinfra', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence([DOCS.delete]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

const record = createProviderRecordReader('DeepInfra')

export const mapDeepinfraVoice = (value: unknown): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = trimmedString(voice['voice_id'])
  const name = trimmedString(voice['name'])
  if (!resourceId || !name) throw CLIUsageError('DeepInfra voice response omits voice_id or name.')
  return {
    provider: 'deepinfra',
    resourceId,
    name,
    source: 'account',
    origin: 'imported-custom',
    ...(trimmedString(voice['description']) ? { description: trimmedString(voice['description']) } : {}),
    labels: {},
    modelIds: [...DEEPINFRA_VOICE_CLONE_MODELS],
    state: 'available',
    sanitizedMetadata: {
      ...(trimmedString(voice['user_id']) ? { userId: trimmedString(voice['user_id']) as string } : {}),
      ...(typeof voice['created_at'] === 'number' ? { createdAt: voice['created_at'] } : {}),
      ...(typeof voice['updated_at'] === 'number' ? { updatedAt: voice['updated_at'] } : {}),
    }
  }
}

const defaultDesignSynthesis = (apiKey: string): DeepinfraDesignSynthesis => async ({ model, body, signal }) => {
  const res = await fetch(`https://api.deepinfra.com/v1/inference/${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  })
  if (!res.ok) {
    const captured = await readRestResponseText(res)
    const payload = captured.truncated ? captured.sanitizedPreview : parseJsonOrText(captured.text)
    throw ProviderError(`DeepInfra voice design failed (${res.status}): ${extractRestErrorMessage(payload, captured.text, res.status)}`, {
      status: res.status,
      headers: res.headers,
      stage: 'tts:deepinfra:voice-design',
      retryable: isRetryableStatus(res.status)
    })
  }
  return await decodeDeepinfraTtsAudio(res)
}

export const createDeepinfraAdvancedProvider = (
  options: CreateDeepinfraAdvancedProviderOptions
): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw CLIUsageError('DeepInfra API key is required for capability inspection.')
  const request = options.request ?? createAdvancedProviderJsonRequest({
    baseUrl: 'https://api.deepinfra.com',
    apiKey: `Bearer ${apiKey}`,
    apiKeyHeader: 'Authorization',
    providerLabel: 'DeepInfra'
  })
  const synthesizeDesign = options.synthesizeDesign ?? defaultDesignSynthesis(apiKey)
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('deepinfra', apiKey)

  const catalog: VoiceCatalogPort = {
    list: async input => {
      if (input?.cursor) throw CLIUsageError('DeepInfra voice catalog is not paginated.')
      if (input?.source === 'provider-library' || input?.source === 'shared-library') {
        const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'deepinfra', entries: [], checkedAt: now() }
        return page
      }
      const payload = record(await request({ method: 'GET', path: '/v1/voices' }), 'voice catalog')
      const entries = Array.isArray(payload['voices']) ? payload['voices'].map(mapDeepinfraVoice) : []
      const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'deepinfra', entries, checkedAt: now() }
      return page
    }
  }

  const createVoice = async (input: {
    name: string
    description: string
    samples: ProviderVoiceCloneRequest['protectedSamples']
    origin: 'designed' | 'instant-clone'
    localAttemptId: string
    sourceRef: string
    sourceIdentityHash: string
    operation: 'designed-from' | 'cloned-from'
  }) => {
    if (!options.resolveProtectedAsset) throw CLIUsageError('DeepInfra voice creation requires a protected-asset resolver.')
    if (input.samples.length === 0) throw CLIUsageError('DeepInfra voice creation requires at least one protected audio sample.')
    const form = new FormData()
    form.set('name', input.name)
    form.set('description', input.description)
    for (const sample of input.samples) {
      const resolved = await options.resolveProtectedAsset(sample)
      if (resolved.bytes.byteLength === 0) throw CLIUsageError('DeepInfra voice samples cannot be empty.')
      form.append('files', new Blob([resolved.bytes], { type: resolved.mediaType }), resolved.fileName)
    }
    const created = record(await request({ method: 'POST', path: '/v1/voices/add', body: form }), 'voice create')
    const resourceId = trimmedString(created['voice_id'])
    if (!resourceId) throw CLIUsageError('DeepInfra voice create response omits voice_id.')
    const checkedAt = now()
    const providerVoice: ProviderVoiceRef = {
      kind: 'remote-resource',
      provider: 'deepinfra',
      resourceId,
      namespace: 'account',
      accountScopeHash,
      origin: input.origin,
      ownership: 'project',
      deletion: { state: 'eligible', checkedAt },
      derivedFrom: {
        sourceRef: input.sourceRef,
        sourceIdentityHash: input.sourceIdentityHash,
        operation: input.operation,
        localAttemptId: input.localAttemptId,
      }
    }
    return { schemaVersion: 1 as const, provider: 'deepinfra' as const, state: 'ready' as const, providerVoice, sanitizedMetadata: mapDeepinfraVoice(created).sanitizedMetadata, checkedAt }
  }

  const design: VoiceDesignPort = {
    createCandidate: async designRequest => {
      if (designRequest.sourceVoice) throw CLIUsageError('DeepInfra Voice Design does not expose a voice remix operation.')
      if (designRequest.seed !== undefined) throw CLIUsageError('DeepInfra Voice Design does not expose a deterministic seed.')
      if (designRequest.candidateCount !== 1) throw CLIUsageError('DeepInfra Voice Design returns exactly one bounded preview per request.')
      if (!isDeepinfraVoiceDesignModel(designRequest.creationModel)) {
        throw CLIUsageError('DeepInfra Voice Design creation model must be XiaomiMiMo/MiMo-V2.5-tts-voicedesign or Qwen/Qwen3-TTS-VoiceDesign.')
      }
      const description = designRequest.description.trim()
      const previewText = designRequest.previewText.trim()
      if (!description) throw CLIUsageError('DeepInfra Voice Design description cannot be blank.')
      if (!previewText) throw CLIUsageError('DeepInfra Voice Design preview text cannot be blank.')
      const body = buildDeepinfraTtsRequestBody({ model: designRequest.creationModel, text: previewText, voice: description })
      const audio = await synthesizeDesign({ model: designRequest.creationModel, body })
      if (audio.byteLength === 0) throw ValidationError('DeepInfra Voice Design returned empty preview audio.', { stage: 'tts:deepinfra:voice-design' })
      const result: ProviderVoiceDesignResult = {
        schemaVersion: 1,
        provider: 'deepinfra',
        operation: 'design',
        creationModel: designRequest.creationModel,
        previews: [{
          providerCandidateId: hashCanonicalTtsValue({ provider: 'deepinfra', creationModel: designRequest.creationModel, description, previewText }),
          audioBase64: Buffer.from(audio).toString('base64'),
          mediaType: 'audio/wav',
          sanitizedMetadata: { creationModel: designRequest.creationModel }
        }],
        checkedAt: now()
      }
      return result
    },
    materializeCandidate: async materializeRequest => {
      if (!materializeRequest.protectedPreview) throw CLIUsageError('DeepInfra candidate materialization requires its protected preview audio.')
      const desiredName = materializeRequest.desiredName.trim()
      if (!desiredName) throw CLIUsageError('DeepInfra materialization requires a desired name.')
      return await createVoice({
        name: desiredName,
        description: desiredName,
        samples: [materializeRequest.protectedPreview],
        origin: 'designed',
        localAttemptId: materializeRequest.localAttemptId,
        sourceRef: materializeRequest.protectedPreview.assetId,
        sourceIdentityHash: materializeRequest.protectedPreview.sha256,
        operation: 'designed-from',
      })
    }
  }

  const clone: VoiceClonePort = {
    clone: async cloneRequest => {
      if (!cloneRequest.consentRecordRef || !cloneRequest.provenanceRef) throw CLIUsageError('DeepInfra cloning requires consent and provenance references before any provider action.')
      if (cloneRequest.cloneKind === 'professional') {
        throw CLIUsageError('DeepInfra does not document a professional voice-clone workflow.')
      }
      const desiredName = cloneRequest.desiredName.trim()
      if (!desiredName) throw CLIUsageError('DeepInfra Instant Voice Cloning requires a display name.')
      const sourceSample = cloneRequest.protectedSamples[0]
      if (!sourceSample) throw CLIUsageError('DeepInfra Instant Voice Cloning requires protected samples and a protected-asset resolver.')
      return await createVoice({
        name: desiredName,
        description: cloneRequest.description?.trim() || desiredName,
        samples: cloneRequest.protectedSamples,
        origin: 'instant-clone',
        localAttemptId: cloneRequest.localAttemptId,
        sourceRef: sourceSample.assetId,
        sourceIdentityHash: sourceSample.sha256,
        operation: 'cloned-from',
      })
    }
  }

  const lifecycle: VoiceLifecyclePort = {
    inspect: async (voice: ProviderVoiceRef): Promise<ProviderVoiceInspection> => {
      if (voice.provider !== 'deepinfra' || voice.kind !== 'remote-resource') throw CLIUsageError('DeepInfra inspection requires a DeepInfra remote voice resource.')
      const entry = mapDeepinfraVoice(await request({ method: 'GET', path: `/v1/voices/${encodeURIComponent(voice.resourceId)}` }))
      if (entry.resourceId !== voice.resourceId) throw CLIUsageError('DeepInfra inspection response identity does not match the registered resource.')
      return { schemaVersion: 1, provider: 'deepinfra', providerVoice: voice, state: entry.state === 'unavailable' ? 'missing' : entry.state, deletion: voice.deletion, sanitizedMetadata: entry.sanitizedMetadata, checkedAt: now() }
    },
    delete: async deleteRequest => {
      const voice = deleteRequest.providerVoice
      if (voice.provider !== 'deepinfra' || voice.kind !== 'remote-resource' || voice.resourceId !== deleteRequest.expectedResourceId) throw CLIUsageError('DeepInfra deletion identity does not match the registered resource.')
      if (voice.namespace !== 'account' || voice.ownership !== 'project' || voice.deletion.state !== 'eligible') throw CLIUsageError('DeepInfra deletes only eligibility-checked project-owned account voices.')
      if (voice.accountScopeHash !== accountScopeHash) throw CLIUsageError('DeepInfra deletion credentials do not match the registered account scope.')
      await request({ method: 'DELETE', path: `/v1/voices/${encodeURIComponent(voice.resourceId)}` })
      return { deletedAt: now() }
    }
  }

  return {
    provider: 'deepinfra',
    accountScopeHash,
    getDeclaredCapabilities: () => DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE.records,
    catalog,
    design,
    clone,
    lifecycle,
  }
}
