import { mkdir, open, rename, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AdvancedProviderHttpRequest, AnyCapabilityRecord, ProtectedAssetRef, ProtectedVoiceAssetStore, ProviderVoiceCatalogEntry, ProviderVoiceRef, TtsVoiceProvider } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { buildAdvancedCapabilityFixture, buildCapabilityDocumentationEvidence, createAdvancedProviderJsonRequest, providerAccountScopeHash } from '../../script-to-audio/advanced-provider-contracts'
import { hashCanonicalTtsValue } from '../../script-to-audio/contract-identity'
import { assertAdvancedVoiceCloneAuthorized, createRemoteResourceVoiceLifecycle } from '../advanced-voice-provider-shell'
import { geminiObject, decodeGeminiAudio } from './gemini-tts-audio'
import { SUPPORTED_GEMINI_TTS_MODELS, validateGeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { serializeGeminiInteraction } from './gemini-tts-request'
import { decodeGeminiInteraction } from './gemini-tts-audio'
import { geminiVoiceExpiry as expiry } from './gemini-voice-availability'
import { validateGeminiVoice } from './gemini-tts-request'

const evidence = buildCapabilityDocumentationEvidence(['https://ai.google.dev/gemini-api/docs/speech-generation', 'https://ai.google.dev/gemini-api/docs/voice-design', 'https://ai.google.dev/gemini-api/docs/voice-replication'], '2026-09-24T00:00:00Z')
const records: AnyCapabilityRecord[] = [
  { scope: { provider: 'gemini', feature: 'voice-catalog' }, maturity: 'stable', channel: 'api', adapterSupport: 'implemented', requirements: [], constraints: { paginated: true, stableResourceIds: true }, documentationEvidence: evidence },
  ...(['voice-design', 'instant-clone', 'voice-import'] as const).map(feature => ({ scope: { provider: 'gemini' as const, feature }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { requiresConsent: feature === 'instant-clone', createsRemoteResource: feature !== 'voice-import' }, documentationEvidence: evidence } as AnyCapabilityRecord)),
  { scope: { provider: 'gemini', feature: 'voice-delete' }, maturity: 'stable', channel: 'api', adapterSupport: 'implemented', requirements: [], constraints: { projectOwnedOnly: true }, documentationEvidence: evidence },
]
export const GEMINI_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(records)
export type GeminiAdvancedProviderOptions = {
  apiKey: string
  request?: AdvancedProviderHttpRequest | undefined
  now?: (() => string) | undefined
  creationJournalRoot?: string | undefined
  protectedStore?: ProtectedVoiceAssetStore | undefined
  resolveProtectedAsset?: ((asset: ProtectedAssetRef) => Promise<{ bytes: Uint8Array, mediaType: string, durationMs: number }>) | undefined
}
const string = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined
const resourceId = (record: Record<string, unknown>): string => {
  const id = string(record['id'])
  if (!id || !/^voice_[A-Za-z0-9_-]+$/.test(id)) throw UsageError('Gemini did not return a persistent voice_ resource.')
  return id
}
export const createGeminiAdvancedProvider = (options: GeminiAdvancedProviderOptions): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const request = options.request ?? createAdvancedProviderJsonRequest({ baseUrl: 'https://generativelanguage.googleapis.com', apiKey: options.apiKey, apiKeyHeader: 'x-goog-api-key', providerLabel: 'Gemini' })
  const now = options.now ?? (() => new Date().toISOString())
  const accountScopeHash = providerAccountScopeHash('gemini', options.apiKey)
  const identity = { provider: 'gemini' as const, label: 'Gemini', labelWithArticle: 'a Gemini', accountScopeHash }
  const voiceRef = (record: Record<string, unknown>, origin: 'designed' | 'instant-clone', createdAt = now()): ProviderVoiceRef => ({
    kind: 'remote-resource', provider: 'gemini', resourceId: resourceId(record), namespace: 'account', accountScopeHash, origin, ownership: 'project', deletion: { state: 'eligible', checkedAt: now() },
    expiresAt: expiry(record) ?? expiry({ create_time: createdAt }),
  })
  const mapVoice = (value: unknown): ProviderVoiceCatalogEntry => {
    const row = geminiObject(value), id = string(row['id'])
    if (!id) throw UsageError('Gemini voice catalog entry omits id.')
    const prebuilt = row['type'] === 'prebuilt', expiresAt = expiry(row)
    return { provider: 'gemini', resourceId: validateGeminiVoice(id), name: string(row['display_name']) ?? id, source: prebuilt ? 'provider-library' : 'account', origin: prebuilt ? 'provider-stock' : row['type'] === 'prompted' ? 'designed' : 'instant-clone', labels: {}, modelIds: string(row['model']) ? [String(row['model'])] : [...SUPPORTED_GEMINI_TTS_MODELS], state: expiresAt && Date.parse(expiresAt) <= Date.parse(now()) ? 'expired' : 'available', ...(expiresAt ? { expiresAt } : {}), sanitizedMetadata: Object.fromEntries(['display_name', 'description', 'type', 'create_time', 'expire_time', 'model'].flatMap(key => string(row[key]) ? [[key, String(row[key])]] : [])) }
  }
  const get = async (id: string) => geminiObject(await request({ method: 'GET', path: `/v1beta/voices/${encodeURIComponent(validateGeminiVoice(id))}` }))
  const requireAvailable = (row: Record<string, unknown>) => { if (mapVoice(row).state === 'expired') throw UsageError('Gemini voice has expired; new synthesis is blocked.') }
  const findCreation = async (id: string): Promise<Record<string, unknown>> => {
    if (!options.creationJournalRoot) throw UsageError('Gemini voice adoption requires its durable creation journal.')
    for (const name of await readdir(options.creationJournalRoot)) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue
      const row = geminiObject(await Bun.file(join(options.creationJournalRoot, name)).json())
      if (row['resourceId'] === id && row['accountScopeHash'] === accountScopeHash) return row
    }
    throw UsageError('Gemini voice resource is not owned by this creation journal.')
  }
  const createDesign = async (input: Parameters<NonNullable<TtsVoiceProvider['design']>['createCandidate']>[0]) => {
    validateGeminiTtsModel(input.creationModel)
    if (input.previewText) serializeGeminiInteraction(input.creationModel, [{ text: input.previewText, speaker: 'Narrator', voice: 'voice_' + 'x'.repeat(190) }])
    if (input.seed !== undefined || input.sourceVoice) throw UsageError('Gemini voice design does not support seed or remix controls.')
    if (!input.desiredName?.trim() || !input.description.trim()) throw UsageError('Gemini design requires a description and --voice-name at creation.')
    if (!Number.isSafeInteger(input.candidateCount) || input.candidateCount < 1 || input.candidateCount > 20) throw UsageError('Gemini design candidate count must be 1-20.')
    if (!options.creationJournalRoot || !options.protectedStore?.storeBytes) throw UsageError('Gemini design requires a durable creation journal and protected preview store.')
    await mkdir(options.creationJournalRoot, { recursive: true, mode: 0o700 })
    const previews = []
    for (let index = 0; index < input.candidateCount; index++) {
      const body = { store: true, voice: { model: input.creationModel, type: 'prompted', display_name: input.desiredName, prompted: { input: input.description } } }
      const fingerprint = hashCanonicalTtsValue({ body, index, accountScopeHash, context: input.creationContext ?? '' })
      const path = join(options.creationJournalRoot, `${fingerprint}.json`)
      let row: Record<string, unknown>, remote: Record<string, unknown>
      const saveRow = async () => {
        const temp = path + '.' + crypto.randomUUID() + '.tmp'
        const handle = await open(temp, 'wx', 0o600)
        try { await handle.writeFile(JSON.stringify(row)); await handle.sync() } finally { await handle.close() }
        await rename(temp, path)
      }
      try {
        const handle = await open(path, 'wx', 0o600)
        row = { schemaVersion: 1, requestFingerprint: fingerprint, accountScopeHash, state: 'submitting', createdAt: now(), desiredName: input.desiredName }
        try { await handle.writeFile(JSON.stringify(row)); await handle.sync() } finally { await handle.close() }
      } catch (error) {
        if ((error as { code?: string }).code !== 'EEXIST') throw error
        row = geminiObject(await Bun.file(path).json())
        if (!string(row['resourceId'])) throw UsageError(`Gemini voice creation ${fingerprint} is ambiguous; reconcile it before any new creation.`)
      }
      if (string(row['resourceId'])) remote = await get(String(row['resourceId']))
      else {
        remote = geminiObject(await request({ method: 'POST', path: '/v1beta/voices', body }))
        // Retain the returned resource before validating or decoding its preview.
        row = { ...row, state: 'created', resourceId: resourceId(remote), expiresAt: expiry(remote) ?? expiry({ create_time: row['createdAt'] }) }
        await saveRow()
      }
      requireAvailable(remote)
      if (typeof row['expiresAt'] === 'string' && Date.parse(row['expiresAt']) <= Date.parse(now())) throw UsageError('Gemini voice has expired; new synthesis is blocked.')
      const original = row['protectedPreview'] as ProtectedAssetRef | undefined
      const audio = original
        ? Buffer.from(await Bun.file(await options.protectedStore.resolve(original)).arrayBuffer())
        : decodeGeminiAudio(geminiObject(remote['sample_audio']), 'audio/wav')
      const protectedPreview = await options.protectedStore.storeBytes(audio, { schemaVersion: 1, purpose: 'candidate-preview', authorizationRef: `gemini-design:${fingerprint}`, retention: { mode: 'retain-until-revoked' }, createdAt: now() })
      row['protectedPreview'] = protectedPreview; await saveRow()
      let additionalPreviewAssets: ProtectedAssetRef[] = []
      if (input.previewText) {
        const previewFingerprint = hashCanonicalTtsValue({ model: input.creationModel, text: input.previewText, voice: resourceId(remote) })
        if (row['previewFingerprint'] && row['previewFingerprint'] !== previewFingerprint) throw UsageError('Gemini creation journal already binds another preview text; use voice audition for additional text.')
        if (row['separatePreviewAsset']) additionalPreviewAssets = [row['separatePreviewAsset'] as ProtectedAssetRef]
        else {
          if (row['previewState'] === 'submitting') throw UsageError('Gemini preview synthesis is ambiguous; reconcile it before redispatch.')
          const body = serializeGeminiInteraction(input.creationModel, [{ text: input.previewText, speaker: 'Narrator', voice: resourceId(remote) }])
          row['previewFingerprint'] = previewFingerprint; row['previewState'] = 'submitting'; await saveRow()
          const previewResponse = await request({ method: 'POST', path: '/v1beta/interactions', body })
          const bytes = decodeGeminiInteraction(previewResponse, 'audio/wav')
          const asset = await options.protectedStore.storeBytes(bytes, { schemaVersion: 1, purpose: 'candidate-preview', authorizationRef: 'gemini-design:' + fingerprint, retention: { mode: 'retain-until-revoked' }, createdAt: now() })
          row['separatePreviewAsset'] = asset; row['previewState'] = 'retained'; await saveRow()
          additionalPreviewAssets = [asset]
        }
      }
      previews.push({ additionalPreviewAssets, providerCandidateId: resourceId(remote), audioBase64: audio.toString('base64'), mediaType: 'audio/wav', expiresAt: string(row['expiresAt']), sanitizedMetadata: { desiredName: input.desiredName, creationFingerprint: fingerprint, protectedPreviewId: protectedPreview.assetId } })
    }
    return { schemaVersion: 1 as const, provider: 'gemini' as const, operation: 'design' as const, creationModel: input.creationModel, previews, checkedAt: now() }
  }
  return {
    provider: 'gemini', accountScopeHash, getDeclaredCapabilities: () => GEMINI_ADVANCED_CAPABILITY_FIXTURE.records,
    catalog: { list: async input => {
      if (input?.source === 'shared-library') throw UsageError('Gemini has no shared-library voice namespace.')
      const source = input?.source ?? 'account'
      const payload = geminiObject(await request({ method: 'GET', path: '/v1beta/voices', query: { ...(source === 'provider-library' ? { type: 'prebuilt' } : {}), page_size: '1000', page_token: input?.cursor } }))
      if (!Array.isArray(payload['voices'])) throw UsageError('Gemini catalog response omits voices.')
      return { schemaVersion: 1, provider: 'gemini', entries: payload['voices'].map(mapVoice).filter(v => v.source === source), nextCursor: string(payload['next_page_token']), checkedAt: now() }
    } },
    design: { createCandidate: createDesign, materializeCandidate: async input => {
      const creation = await findCreation(input.providerCandidateId)
      if (creation['desiredName'] !== input.desiredName) throw UsageError('Gemini save must use the name established during creation.')
      const remote = await get(input.providerCandidateId); requireAvailable(remote)
      if (resourceId(remote) !== input.providerCandidateId || remote['display_name'] !== input.desiredName) throw UsageError('Gemini saved resource identity/name changed.')
      return { schemaVersion: 1, provider: 'gemini', state: 'ready', providerVoice: voiceRef(remote, 'designed', String(creation['createdAt'])), sanitizedMetadata: { desiredName: input.desiredName, createdAt: String(creation['createdAt']) }, checkedAt: now() }
    } },
    clone: { clone: async input => {
      assertAdvancedVoiceCloneAuthorized(identity, input, 'before upload')
      if (input.cloneKind !== 'instant' || input.protectedSamples.length !== 1 || !input.protectedConsentAudio || !options.resolveProtectedAsset) throw UsageError('Gemini replication requires one reference recording and separate protected consent audio.')
      const model = validateGeminiTtsModel(input.providerModel ?? '')
      const source = await options.resolveProtectedAsset(input.protectedSamples[0]!), consent = await options.resolveProtectedAsset(input.protectedConsentAudio)
      if (input.protectedConsentAudio.sha256 === input.protectedSamples[0]!.sha256) throw UsageError('Gemini reference and consent recordings must be separate.')
      if (!Number.isFinite(source.durationMs) || source.durationMs < 10000 || source.durationMs > 30000 || !Number.isFinite(consent.durationMs) || consent.durationMs <= 0 || !source.bytes.length || !consent.bytes.length) throw UsageError('Gemini requires a decoded 10-30 second reference and a valid separate recorded consent statement.')
      const audio = (sample: typeof source) => ({ mime_type: sample.mediaType, data: Buffer.from(sample.bytes).toString('base64') })
      const remote = geminiObject(await request({ method: 'POST', path: '/v1beta/voices', body: { store: true, voice: { model, type: 'replicated', display_name: input.desiredName, replicated: { source_audio: audio(source), consent_audio: audio(consent) } } } }))
      return { schemaVersion: 1, provider: 'gemini', state: 'ready', providerVoice: voiceRef(remote, 'instant-clone'), sanitizedMetadata: { desiredName: input.desiredName, createdAt: now() }, checkedAt: now() }
    } },
    lifecycle: createRemoteResourceVoiceLifecycle(identity, { ownedResourceLabel: 'stored voices' }, {
      fetchVoice: async voice => { const row = await get(voice.resourceId); if (String(row['id']) !== voice.resourceId) throw UsageError('Gemini inspection returned a different voice.'); const entry = mapVoice(row); return { state: entry.state === 'expired' ? 'expired' : 'available', sanitizedMetadata: entry.sanitizedMetadata } },
      deleteVoice: async voice => { await request({ method: 'DELETE', path: `/v1beta/voices/${encodeURIComponent(voice.resourceId)}` }) }, now,
    }),
  }
}
