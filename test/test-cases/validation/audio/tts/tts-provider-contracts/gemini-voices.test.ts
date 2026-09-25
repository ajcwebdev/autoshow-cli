import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { createGeminiAdvancedProvider } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-advanced-provider'
import { createProtectedVoiceAssetStore } from '~/cli/commands/audio/voice/voice-assets/protected-voice-asset-store'
import { createAdvancedVoiceCandidates } from '~/cli/commands/audio/voice/advanced-voice-management'
import { assertGeminiVoiceAvailable, geminiVoiceExpiry } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-voice-availability'
import { validateGeminiReferenceRecording } from '~/cli/commands/audio/voice/voice-assets/gemini-reference-audio-preflight'
import { setupTtsContractLifecycle } from './shared'
import { FLASH, LITE, wav, unary } from './gemini-fixtures'
import { createSyntheticWavBytes } from '../../../../../test-utils/media-fixtures'
import type { AdvancedProviderHttpRequest, ProviderVoiceCloneRequest, ProviderVoiceDesignRequest } from '~/types'
const { makeTempDir } = setupTtsContractLifecycle()
const date = '2026-09-24T00:00:00.000Z'
const voice = (id = 'voice_test') => ({ id, type: 'prompted', display_name: 'Narrator', model: LITE, create_time: date, sample_audio: { mime_type: 'audio/wav', data: wav.toString('base64') } })
const design: ProviderVoiceDesignRequest = { description: 'Warm documentary narrator.', desiredName: 'Narrator', creationModel: LITE, previewText: '', candidateCount: 1 }
type RequestHandler = (input: Parameters<AdvancedProviderHttpRequest>[0]) => Promise<unknown>
const jsonRequest = (handler: RequestHandler): AdvancedProviderHttpRequest => async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]) => await handler(input) as T
const setup = async (request: RequestHandler) => {
  const root = await makeTempDir('gemini-voices-'), creationJournalRoot = join(root, 'creations'), store = createProtectedVoiceAssetStore({ storeId: 'gemini_fixture', root: join(root, 'protected') })
  const provider = createGeminiAdvancedProvider({ apiKey: 'fixture-key', request: jsonRequest(request), now: () => date, creationJournalRoot, protectedStore: store })
  return { root, creationJournalRoot, store, provider }
}

test('design journals each persistent creation, retains original and separate previews, and save adopts without recreation', async () => {
  const calls: Array<{ method: string, path: string, body?: unknown }> = []
  let posts = 0
  const fixture = await setup(async input => {
    calls.push(input)
    if (input.path === '/v1beta/interactions') return unary(createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 0.4, frequencyHz: 660, amplitude: 0.2 }).toString('base64'))
    if (input.method === 'POST') return voice(`voice_${++posts}`)
    return voice(input.path.split('/').at(-1))
  })
  const candidates = await createAdvancedVoiceCandidates({ charactersRoot: join(fixture.root, 'characters'), protectedStore: fixture.store, provider: fixture.provider, providerModel: LITE, creationModel: LITE, subjectKey: 'narrator', profileKey: 'default', description: design.description, desiredName: 'Narrator', previewText: 'A separate requested passage.', candidateCount: 2, now: () => date })
  expect(posts).toBe(2)
  expect(candidates).toHaveLength(2)
  for (const candidate of candidates) {
    expect(candidate.previewAssets).toHaveLength(2)
    expect(Buffer.from(await Bun.file(await fixture.store.resolve(candidate.previewAssets[0]!)).arrayBuffer())).toEqual(Buffer.from(wav))
    expect(candidate.providerModel).toBe(LITE)
    expect(candidate.expiresAt).toBe('2027-09-24T00:00:00.000Z')
  }
  expect(calls[0]).toMatchObject({ method: 'POST', path: '/v1beta/voices', body: { store: true, voice: { model: LITE, type: 'prompted', display_name: 'Narrator', prompted: { input: design.description } } } })
  const saved = await fixture.provider.design!.materializeCandidate({ providerCandidateId: 'voice_1', desiredName: 'Narrator', localAttemptId: 'save-1' })
  expect(saved.providerVoice).toMatchObject({ resourceId: 'voice_1', ownership: 'project', expiresAt: '2027-09-24T00:00:00.000Z' })
  expect(posts).toBe(2)
  await expect(fixture.provider.design!.materializeCandidate({ providerCandidateId: 'voice_1', desiredName: 'Changed', localAttemptId: 'save-2' })).rejects.toThrow('name')
  expect((await readdir(fixture.creationJournalRoot)).filter(name => name.endsWith('.json'))).toHaveLength(2)
})

test('creation crash before response is ambiguous and cannot recreate a voice', async () => {
  let calls = 0
  const fixture = await setup(async () => { calls++; throw Error('Connection lost after remote creation') })
  await expect(fixture.provider.design!.createCandidate(design)).rejects.toThrow()
  await expect(fixture.provider.design!.createCandidate(design)).rejects.toThrow('ambiguous')
  expect(calls).toBe(1)
})

test('returned resource is journaled before corrupt preview validation and can be recovered without another creation', async () => {
  let posts = 0
  const fixture = await setup(async input => {
    if (input.method === 'POST') { posts++; return { ...voice(), sample_audio: { mime_type: 'audio/wav', data: 'broken' } } }
    return voice()
  })
  await expect(fixture.provider.design!.createCandidate(design)).rejects.toThrow()
  const recovered = await fixture.provider.design!.createCandidate(design)
  expect(recovered.previews[0]?.providerCandidateId).toBe('voice_test')
  expect(posts).toBe(1)
})

test('catalog pagination distinguishes stock and stored voices and rejects shared libraries', async () => {
  const calls: unknown[] = []
  const fixture = await setup(async input => { calls.push(input); return { voices: [{ id: 'Kore', type: 'prebuilt' }, voice()], next_page_token: 'next-page' } })
  const account = await fixture.provider.catalog!.list({ source: 'account', cursor: 'previous' })
  expect(account.entries.map(entry => entry.resourceId)).toEqual(['voice_test'])
  expect(account.nextCursor).toBe('next-page')
  expect(account.entries[0]).toMatchObject({ origin: 'designed', expiresAt: '2027-09-24T00:00:00.000Z', modelIds: [LITE] })
  const stock = await fixture.provider.catalog!.list({ source: 'provider-library' })
  expect(stock.entries.map(entry => entry.resourceId)).toEqual(['Kore'])
  await expect(fixture.provider.catalog!.list({ source: 'shared-library' })).rejects.toThrow('shared-library')
  expect(calls).toHaveLength(2)
})

test('seed/remix reject without dispatch; model and expiry validation block unavailable resources', async () => {
  let calls = 0
  const fixture = await setup(async () => { calls++; return voice() })
  await expect(fixture.provider.design!.createCandidate({ ...design, seed: 1 })).rejects.toThrow('seed')
  await expect(fixture.provider.design!.createCandidate({ ...design, creationModel: 'unknown' })).rejects.toThrow()
  expect(calls).toBe(0)
  expect(geminiVoiceExpiry({ create_time: date })).toBe('2027-09-24T00:00:00.000Z')
  expect(() => assertGeminiVoiceAvailable(voice(), 'voice_test', FLASH, new Date(date))).toThrow('incompatible')
  expect(() => assertGeminiVoiceAvailable({ ...voice(), expire_time: '2026-09-01T00:00:00Z' }, 'voice_test', LITE, new Date(date))).toThrow('expired')
})

test('delete only project-owned resources with matching account and resource identity', async () => {
  const calls: Array<{ method: string }> = []
  const fixture = await setup(async input => { calls.push(input); return input.method === 'DELETE' ? {} : voice() })
  await fixture.provider.design!.createCandidate(design)
  const saved = await fixture.provider.design!.materializeCandidate({ providerCandidateId: 'voice_test', desiredName: 'Narrator', localAttemptId: 'save' })
  const owned = saved.providerVoice!
  await expect(fixture.provider.lifecycle!.delete({ providerVoice: { ...owned, ownership: 'account' } as typeof owned, expectedResourceId: 'voice_test' })).rejects.toThrow('project-owned')
  await expect(fixture.provider.lifecycle!.delete({ providerVoice: owned, expectedResourceId: 'voice_other' })).rejects.toThrow('identity')
  const inspection = await fixture.provider.lifecycle!.inspect(owned)
  expect(inspection.state).toBe('available')
  await fixture.provider.lifecycle!.delete({ providerVoice: owned, expectedResourceId: 'voice_test' })
  expect(calls.filter(call => call.method === 'DELETE')).toHaveLength(1)
})

test('replication requires separate protected consent, validated reference duration, and persistent storage', async () => {
  const reference = { storeId: 'gemini_fixture', assetId: 'sha256_' + 'a'.repeat(64), sha256: 'a'.repeat(64) }, consent = { ...reference, assetId: 'sha256_' + 'b'.repeat(64), sha256: 'b'.repeat(64) }
  const calls: unknown[] = []
  let durationMs = 15000
  const provider = createGeminiAdvancedProvider({ apiKey: 'fixture-key', request: jsonRequest(async input => { calls.push(input); return { ...voice(), type: 'replicated' } }), now: () => date, resolveProtectedAsset: async asset => ({ bytes: wav, durationMs: asset.sha256 === reference.sha256 ? durationMs : 5000, mediaType: 'audio/wav' }) })
  const request: ProviderVoiceCloneRequest = { cloneKind: 'instant', providerModel: LITE, desiredName: 'Narrator', localAttemptId: 'clone', protectedSamples: [reference], protectedConsentAudio: consent, consentRecordRef: 'protected-consent:v1:fixture', provenanceRef: 'test:consent' }
  await expect(provider.clone!.clone({ ...request, protectedConsentAudio: undefined })).rejects.toThrow('consent')
  await expect(provider.clone!.clone({ ...request, protectedConsentAudio: reference })).rejects.toThrow('separate')
  await expect(provider.clone!.clone({ ...request, consentRecordRef: '' })).rejects.toThrow('consent')
  durationMs = 9999
  await expect(provider.clone!.clone(request)).rejects.toThrow('10-30')
  expect(calls).toHaveLength(0)
  durationMs = 15000
  const result = await provider.clone!.clone(request)
  expect(result.providerVoice).toMatchObject({ origin: 'instant-clone', ownership: 'project' })
  expect(calls[0]).toMatchObject({ method: 'POST', path: '/v1beta/voices', body: { store: true, voice: { type: 'replicated', model: LITE, replicated: { source_audio: { mime_type: 'audio/wav' }, consent_audio: { mime_type: 'audio/wav' } } } } })
})

test('local reference verification rejects truncated media before upload', async () => {
  const root = await makeTempDir('gemini-media-'), file = join(root, 'reference.wav')
  const reference = createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 10, frequencyHz: 440, amplitude: 0.1 })
  await Bun.write(file, reference)
  expect(await validateGeminiReferenceRecording(file)).toBe(10000)
  await Bun.write(file, reference.subarray(0, 100))
  await expect(validateGeminiReferenceRecording(file)).rejects.toThrow()
})

test('invalid preview text is rejected before creating a persistent resource', async () => {
  let calls = 0
  const fixture = await setup(async () => { calls++; return voice() })
  await expect(fixture.provider.design!.createCandidate({ ...design, previewText: 'x'.repeat(8192) })).rejects.toThrow('input-token')
  expect(calls).toBe(0)
})

test('Gemini auditions dispatch the selected model and approvals remain model-specific', async () => {
  const { buildReadyVoiceRegistrationDraft } = await import('~/cli/commands/audio/voice/voice-registration-management')
  const { appendVoiceRegistration, writeCharacterVoiceBriefCatalog, recordVoiceAudition, approveVoiceRegistration, requireCurrentVoiceRegistration, transitionVoiceRegistrationLifecycle } = await import('~/cli/commands/audio/voice/character-voice-registry')
  const { runCanonicalVoiceAudition } = await import('~/cli/commands/audio/voice/canonical-voice-audition')
  const { installMockFetch, jsonResponse } = await import('../../../../../test-utils/rest-contract-helpers')
  const root = await makeTempDir('gemini-approval-'), store = createProtectedVoiceAssetStore({ storeId: 'gemini_audition', root: join(root, 'protected') }), charactersRoot = join(root, 'characters')
  const brief: import('~/types').CharacterVoiceBrief = { subjectKey: 'narrator', profileKey: 'default', language: 'en', locale: 'en-US', timbre: 'Warm', mannerisms: [], prohibitedCaricatures: [], pronunciations: [], allowedOrigins: ['provider-stock'] }
  await writeCharacterVoiceBriefCatalog(charactersRoot, { schemaVersion: 1, briefs: [brief] })
  const providerVoice = { kind: 'remote-resource' as const, provider: 'gemini' as const, resourceId: 'Kore', namespace: 'provider' as const, origin: 'provider-stock' as const, ownership: 'provider' as const, deletion: { state: 'provider-managed' as const, checkedAt: date } }
  const draft = buildReadyVoiceRegistrationDraft({ subjectKey: 'narrator', profileKey: 'default', provider: 'gemini', providerModel: LITE, providerVoice, brief, provenanceRef: 'fixture:casting', capabilityFixtureHash: 'b'.repeat(64), createdAt: date })
  await appendVoiceRegistration(charactersRoot, draft)
  process.env['GEMINI_API_KEY'] = 'fixture-key'
  const calls = installMockFetch(() => jsonResponse(unary()))
  const audition = await runCanonicalVoiceAudition({ registration: draft, brief, representativeLine: 'A representative line.', protectedStore: store })
  expect(audition.providerModel).toBe(LITE)
  expect(calls).toHaveLength(6)
  expect(calls.every(call => call.bodyJson?.['model'] === LITE)).toBe(true)
  expect(JSON.stringify(calls[2]?.bodyJson)).toContain('quiet reassurance')
  const auditioned = await recordVoiceAudition({ charactersRoot, registrationId: draft.registrationId, generationId: draft.generationId, audition })
  const approved = await approveVoiceRegistration({ charactersRoot, registrationId: draft.registrationId, generationId: auditioned.generationId, audition, approvedBy: { namespace: 'local-user', actorId: 'fixture' }, expectedIndexRevision: 0 })
  expect((await requireCurrentVoiceRegistration(charactersRoot, 'narrator', 'gemini', LITE, 'default')).generationId).toBe(approved.generationId)
  await expect(requireCurrentVoiceRegistration(charactersRoot, 'narrator', 'gemini', FLASH, 'default')).rejects.toThrow('No approved current')
  await transitionVoiceRegistrationLifecycle({ charactersRoot, registrationId: approved.registrationId, generationId: approved.generationId, action: 'revoke', reason: 'Fixture authorization withdrawn' })
  await expect(requireCurrentVoiceRegistration(charactersRoot, 'narrator', 'gemini', LITE, 'default')).rejects.toThrow()
}, 20000)
