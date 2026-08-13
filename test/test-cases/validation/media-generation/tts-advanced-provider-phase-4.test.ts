import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProviderVoiceRef, TtsEntryMetadata } from '~/types'
import type { AdvancedProviderHttpRequest } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/advanced-provider-contracts'
import { validateProviderVoiceRef } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-validation'
import {
  createMiniMaxAdvancedProvider,
  MINIMAX_ADVANCED_CAPABILITY_FIXTURE,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-minimax/minimax-advanced-provider'
import {
  CARTESIA_ADVANCED_CAPABILITY_FIXTURE,
  createCartesiaAdvancedProvider,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/cartesia/cartesia-advanced-provider'
import {
  createSpeechifyAdvancedProvider,
  SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-advanced-provider'
import { discoverAudioFiles, makeProviderKey, makeTtsBenchmarkKey } from '~/cli/commands/setup-and-utilities/benchmark/tts-eval-lib'

const CHECKED_AT = '2026-08-11T00:00:00.000Z'
const protectedSample = { storeId: 'voice_store', assetId: `sha256_${'a'.repeat(64)}`, sha256: 'a'.repeat(64) }
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Phase 4 capability fixtures', () => {
  test('declare implemented management facets without inventing native dialogue or design support', () => {
    for (const fixture of [MINIMAX_ADVANCED_CAPABILITY_FIXTURE, CARTESIA_ADVANCED_CAPABILITY_FIXTURE, SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE]) {
      expect(fixture.capabilityFixtureHash).toHaveLength(64)
      expect(fixture.records.find(record => record.scope.feature === 'voice-catalog')).toEqual(expect.objectContaining({ adapterSupport: 'implemented' }))
      expect(fixture.records.find(record => record.scope.feature === 'native-dialogue')).toEqual(expect.objectContaining({ maturity: 'not-applicable', channel: 'unsupported', adapterSupport: 'unsupported' }))
    }
    expect(MINIMAX_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'voice-design')).toEqual(expect.objectContaining({ adapterSupport: 'implemented' }))
    expect(CARTESIA_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'voice-design')).toEqual(expect.objectContaining({ adapterSupport: 'unsupported' }))
    expect(SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'voice-design')).toEqual(expect.objectContaining({ adapterSupport: 'unsupported' }))
  })
})

describe('MiniMax advanced voice adapter', () => {
  test('normalizes catalogs, protects temporary design identity, and clones through upload then create', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.path === '/v1/get_voice') return { system_voice: [{ voice_id: 'stock-1', voice_name: 'Stock' }], voice_cloning: [{ voice_id: 'clone-1', voice_name: 'Clone' }], voice_generation: [{ voice_id: 'design-1', voice_name: 'Design' }], base_resp: { status_code: 0 } } as T
      if (input.path === '/v1/voice_design') return { voice_id: 'candidate-1', trial_audio: '010203', base_resp: { status_code: 0 } } as T
      if (input.path === '/v1/files/upload') return { file: { file_id: 123456789 }, base_resp: { status_code: 0 } } as T
      if (input.path === '/v1/voice_clone') return { voice_id: 'clone_voice_1', base_resp: { status_code: 0 } } as T
      if (input.path === '/v1/delete_voice') return { voice_id: 'clone_voice_1', base_resp: { status_code: 0 } } as T
      throw new Error(`Unexpected request ${input.path}`)
    }
    const adapter = createMiniMaxAdvancedProvider({
      apiKey: 'minimax-key', request, now: () => CHECKED_AT,
      resolveProtectedAsset: async () => ({ bytes: new Uint8Array([1, 2, 3]), fileName: 'sample.wav', mediaType: 'audio/wav', durationMs: 12_000 })
    })
    const account = await adapter.catalog!.list({ source: 'account' })
    expect(account.entries.map(entry => [entry.resourceId, entry.origin])).toEqual([['clone-1', 'instant-clone'], ['design-1', 'designed']])
    const designed = await adapter.design!.createCandidate({ description: 'Warm documentary narrator', previewText: 'A bounded preview.', candidateCount: 1, creationModel: 'voice-design' })
    expect(designed.previews[0]).toEqual(expect.objectContaining({ providerCandidateId: 'candidate-1', audioBase64: 'AQID', expiresAt: '2026-08-18T00:00:00.000Z' }))
    const cloned = await adapter.clone!.clone({ cloneKind: 'instant', desiredName: 'clone_voice_1', localAttemptId: 'attempt-1', protectedSamples: [protectedSample], consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:casting' })
    expect(cloned.providerVoice).toEqual(expect.objectContaining({ resourceId: 'clone_voice_1', origin: 'instant-clone', expiresAt: '2026-08-18T00:00:00.000Z' }))
    expect(() => validateProviderVoiceRef(cloned.providerVoice as ProviderVoiceRef)).not.toThrow()
    await adapter.lifecycle!.delete({ providerVoice: cloned.providerVoice as ProviderVoiceRef, expectedResourceId: 'clone_voice_1' })
    expect(calls.map(call => call.path)).toEqual(['/v1/get_voice', '/v1/voice_design', '/v1/files/upload', '/v1/voice_clone', '/v1/delete_voice'])
    expect(calls[2]?.body).toBeInstanceOf(FormData)
  })
})

describe('Cartesia and Speechify advanced voice adapters', () => {
  test('Cartesia preserves pagination and keeps professional cloning external', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.method === 'GET') return { data: [{ id: 'voice-1', name: 'Guide', is_owner: true, language: 'en' }], has_more: true, next_page: 'voice-1' } as T
      return { id: 'clone-1', name: 'Clone', is_owner: true, language: 'en' } as T
    }
    const adapter = createCartesiaAdvancedProvider({
      apiKey: 'cartesia-key', request, now: () => CHECKED_AT,
      resolveProtectedAsset: async () => ({ bytes: new Uint8Array([1]), fileName: 'sample.wav', mediaType: 'audio/wav' })
    })
    const page = await adapter.catalog!.list({ source: 'account', cursor: 'prior' })
    expect(page.nextCursor).toBe('voice-1')
    expect(calls[0]?.query).toEqual(expect.objectContaining({ starting_after: 'prior', is_owner: 'true' }))
    const cloned = await adapter.clone!.clone({ cloneKind: 'instant', desiredName: 'Clone', localAttemptId: 'attempt-cartesia', protectedSamples: [protectedSample], consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:casting' })
    expect(cloned.providerVoice).toEqual(expect.objectContaining({ resourceId: 'clone-1', origin: 'instant-clone' }))
    const callsBeforeProfessional = calls.length
    const professional = await adapter.clone!.clone({ cloneKind: 'professional', desiredName: 'Pro Clone', localAttemptId: 'attempt-pro', protectedSamples: [], consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:casting' })
    expect(professional).toEqual(expect.objectContaining({ state: 'external-action-required', action: expect.stringContaining('dashboard') }))
    expect(calls).toHaveLength(callsBeforeProfessional)
  })

  test('Speechify serializes protected consent and idempotency without returning PII', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.method === 'GET') return { voices: [{ id: 'shared-1', display_name: 'Narrator', type: 'shared', models: [{ name: 'simba-3.0' }] }], has_more: false } as T
      return { id: 'personal-1', display_name: 'Personal', type: 'personal', models: [{ name: 'simba-3.0' }] } as T
    }
    const adapter = createSpeechifyAdvancedProvider({
      apiKey: 'speechify-key', request, now: () => CHECKED_AT,
      resolveProtectedAsset: async () => ({ bytes: new Uint8Array([1, 2]), fileName: 'sample.wav', mediaType: 'audio/wav', durationMs: 15_000 }),
      resolveProtectedConsent: async () => ({ fullName: 'Authorized Speaker', email: 'speaker@example.com', locale: 'en-US', gender: 'not_specified' })
    })
    const catalog = await adapter.catalog!.list({ source: 'provider-library' })
    expect(catalog.entries[0]).toEqual(expect.objectContaining({ resourceId: 'shared-1', modelIds: ['simba-3.0'], source: 'provider-library' }))
    const cloned = await adapter.clone!.clone({ cloneKind: 'instant', desiredName: 'Personal', localAttemptId: 'attempt-speechify', protectedSamples: [protectedSample], consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:casting' })
    expect(cloned.providerVoice).toEqual(expect.objectContaining({ resourceId: 'personal-1', origin: 'instant-clone' }))
    expect(JSON.stringify(cloned)).not.toContain('speaker@example.com')
    const createCall = calls[1]
    expect(createCall?.headers).toEqual({ 'Idempotency-Key': 'attempt-speechify' })
    expect((createCall?.body as FormData).get('consent')).toBe(JSON.stringify({ fullName: 'Authorized Speaker', email: 'speaker@example.com' }))
  })
})

describe('voice-aware TTS benchmark identity', () => {
  test('keeps same-provider/model renders distinct while preserving explicit legacy fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-tts-benchmark-'))
    roots.push(root)
    await Promise.all([writeFile(join(root, 'voice-a.wav'), 'a'), writeFile(join(root, 'voice-b.wav'), 'b')])
    const base: Omit<TtsEntryMetadata, 'audioFileName'> = { ttsService: 'openai', ttsModel: 'gpt-4o-mini-tts', processingTime: 1, audioFileSize: 1, chunkCount: 1, targetKey: 'tts-synthesis:openai:gpt-4o-mini-tts:hosted-api' }
    const entries: TtsEntryMetadata[] = [
      { ...base, audioFileName: 'voice-a.wav', renderIdentity: 'a'.repeat(64), snapshotEntryId: 'entry-a', characterIdentity: 'hero' },
      { ...base, audioFileName: 'voice-b.wav', renderIdentity: 'b'.repeat(64), snapshotEntryId: 'entry-b', characterIdentity: 'narrator' }
    ]
    const firstKey = makeTtsBenchmarkKey(entries[0]!)
    const secondKey = makeTtsBenchmarkKey(entries[1]!)
    expect(firstKey).not.toBe(secondKey)
    expect(firstKey).toContain(`render:${'a'.repeat(64)}`)
    expect(firstKey).toContain('snapshot-entry:entry-a')
    expect(firstKey).toContain('character:hero')
    const discovered = discoverAudioFiles(root, entries)
    expect(discovered.found.size).toBe(2)
    expect(makeProviderKey('openai', 'gpt-4o-mini-tts')).toBe('openai/gpt-4o-mini-tts')
    expect(makeTtsBenchmarkKey({ ...entries[0]!, targetKey: undefined, renderIdentity: undefined, snapshotEntryId: undefined, characterIdentity: undefined })).toBe('legacy:openai/gpt-4o-mini-tts')
  })
})
