import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  AdvancedProviderHttpRequest,
  CharacterVoiceBrief,
  ProviderVoiceRef,
  TtsRequestEvidenceScope,
  TtsSerializedRequestObservation,
  TtsTarget,
  TtsVoiceProvider,
} from '~/types'
import { validateProviderVoiceRef } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-validation'
import { planCurrentTtsReadiness } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { listHumeVoiceIdsForReadiness, listInworldVoiceIdsForReadiness } from '~/cli/commands/process-steps/step-4-tts/tts-targets/execution-preflight'
import { hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import {
  createElevenLabsAdvancedProvider,
  ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE,
  ELEVENLABS_DEFAULT_VOICE_EXPIRY,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-advanced-provider'
import {
  normalizeElevenLabsDialogueTiming,
  planElevenLabsNativeDialogueBatches,
  prepareElevenLabsDialogueText,
  runElevenLabsNativeDialogue,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import {
  createHumeAdvancedProvider,
  HUME_ADVANCED_CAPABILITY_FIXTURE,
  resolveUniqueHumeVoiceName,
  validateHumeContinuation,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/hume/hume-advanced-provider'
import {
  normalizeHumeGenerationTiming,
  planHumeNativeUtteranceBatches,
  runHumeNativeUtterances,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/hume/hume-native-utterances'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import {
  createAdvancedVoiceCandidates,
  materializeAdvancedVoiceCandidate,
} from '~/cli/commands/process-steps/step-4-tts/voice-management/advanced-voice-management'
import { createMockWavBase64 } from '../../../test-utils/media-fixtures'

const CHECKED_AT = '2026-08-11T00:00:00.000Z'
const roots: string[] = []

const makeRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-phase-3-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

const accountVoice = (
  provider: 'elevenlabs' | 'hume',
  resourceId: string,
  accountScopeHash: string
): Extract<ProviderVoiceRef, { kind: 'remote-resource' }> => ({
  kind: 'remote-resource',
  provider,
  resourceId,
  namespace: 'account',
  accountScopeHash,
  origin: 'imported-custom',
  ownership: 'account',
  deletion: { state: 'external-only', checkedAt: CHECKED_AT }
})

describe('Phase 3 capability and catalog contracts', () => {
  test('dated ElevenLabs and Hume fixtures load with truthful advanced facets', () => {
    expect(ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash).toHaveLength(64)
    expect(HUME_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash).toHaveLength(64)
    expect(ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE.records.map(record => record.scope.feature)).toContain('native-dialogue')
    expect(HUME_ADVANCED_CAPABILITY_FIXTURE.records.map(record => record.scope.feature)).toContain('native-utterances')
    expect(HUME_ADVANCED_CAPABILITY_FIXTURE.records.find(record => record.scope.feature === 'instant-clone')).toEqual(expect.objectContaining({ channel: 'ui-only', adapterSupport: 'planned' }))
  })

  test('ElevenLabs normalizes account and shared catalogs, pagination, verification, and legacy default expiry', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.path === '/v1/shared-voices') return {
        voices: [{ voice_id: 'shared-1', name: 'Shared Voice', category: 'professional', public_owner_id: 'owner-1' }],
        has_more: true,
        last_sort_id: 'cursor-2'
      } as T
      return {
        voices: [
          { voice_id: 'default-legacy', name: 'Legacy Default', category: 'premade', is_legacy: true },
          { voice_id: 'clone-pending', name: 'Clone Pending', category: 'cloned', fine_tuning: { state: { eleven_multilingual_v2: 'not_verified' } } }
        ],
        next_page_token: 'next-account'
      } as T
    }
    const adapter = createElevenLabsAdvancedProvider({ apiKey: 'account-key', request, now: () => CHECKED_AT })
    const account = await adapter.catalog!.list({ source: 'account', cursor: 'current-account' })
    expect(account.nextCursor).toBe('next-account')
    expect(account.entries[0]).toEqual(expect.objectContaining({ resourceId: 'default-legacy', expiresAt: ELEVENLABS_DEFAULT_VOICE_EXPIRY, state: 'available' }))
    expect(account.entries[1]?.state).toBe('verification-required')
    const shared = await adapter.catalog!.list({ source: 'shared-library', cursor: 'cursor-1' })
    expect(shared.entries[0]).toEqual(expect.objectContaining({ resourceId: 'shared-1', source: 'shared-library', origin: 'community-library' }))
    expect(shared.nextCursor).toBe('cursor-2')
    expect(calls).toEqual([
      expect.objectContaining({ method: 'GET', path: '/v2/voices', query: expect.objectContaining({ next_page_token: 'current-account' }) }),
      expect.objectContaining({ method: 'GET', path: '/v1/shared-voices', query: expect.objectContaining({ last_sort_id: 'cursor-1' }) })
    ])
  })

  test('Hume normalizes stable library/custom IDs and rejects ambiguous display names', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      return {
        page_number: Number(input.query?.['page_number'] ?? '0'), page_size: 100, total_pages: 2,
        voices_page: [{ id: input.query?.['provider'] === 'CUSTOM_VOICE' ? 'custom-1' : 'stock-1', name: 'Guide', provider: input.query?.['provider'] }]
      } as T
    }
    const adapter = createHumeAdvancedProvider({ apiKey: 'hume-key', request, now: () => CHECKED_AT })
    const stock = await adapter.catalog!.list({ source: 'provider-library' })
    const custom = await adapter.catalog!.list({ source: 'account', cursor: '1' })
    expect(stock.entries[0]).toEqual(expect.objectContaining({ resourceId: 'stock-1', origin: 'provider-stock' }))
    expect(custom.entries[0]).toEqual(expect.objectContaining({ resourceId: 'custom-1', origin: 'imported-custom' }))
    expect(stock.nextCursor).toBe('1')
    expect(custom.nextCursor).toBeUndefined()
    expect(calls).toEqual([
      expect.objectContaining({ query: { provider: 'HUME_AI', page_number: '0', page_size: '100' } }),
      expect.objectContaining({ query: { provider: 'CUSTOM_VOICE', page_number: '1', page_size: '100' } })
    ])
    expect(resolveUniqueHumeVoiceName(custom.entries, 'Guide').resourceId).toBe('custom-1')
    expect(() => resolveUniqueHumeVoiceName([...custom.entries, { ...custom.entries[0]!, resourceId: 'custom-2' }], 'Guide')).toThrow('exactly one stable provider ID')
  })

  test('Hume readiness collects every voice-catalog page from both namespaces', async () => {
    const calls: string[] = []
    const fetchImpl = (async (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(String(input))
      calls.push(url.search)
      const provider = url.searchParams.get('provider')
      const pageNumber = Number(url.searchParams.get('page_number'))
      return Response.json({
        page_number: pageNumber,
        page_size: 100,
        total_pages: provider === 'CUSTOM_VOICE' ? 2 : 1,
        voices_page: [{ id: `${provider}-${pageNumber}`, name: 'Voice', provider }]
      })
    }) as typeof fetch
    const ids = await listHumeVoiceIdsForReadiness('hume-key', fetchImpl)
    expect([...ids]).toEqual(['HUME_AI-0', 'CUSTOM_VOICE-0', 'CUSTOM_VOICE-1'])
    expect(calls).toEqual([
      '?provider=HUME_AI&page_number=0&page_size=100',
      '?provider=CUSTOM_VOICE&page_number=0&page_size=100',
      '?provider=CUSTOM_VOICE&page_number=1&page_size=100'
    ])
  })

  test('Inworld readiness resolves exact current voice IDs with Basic authentication', async () => {
    const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      expect(String(input)).toBe('https://api.inworld.ai/voices/v1/voices?languages=EN_US')
      expect(new Headers(init?.headers).get('Authorization')).toBe('Basic inworld-key')
      return Response.json({ voices: [{ voiceId: 'Alex' }, { voiceId: 'Dennis' }] })
    }) as typeof fetch
    expect([...await listInworldVoiceIdsForReadiness('inworld-key', fetchImpl)]).toEqual(['Alex', 'Dennis'])
  })
})

describe('Phase 3 design, lineage, clone, and lifecycle contracts', () => {
  test('ElevenLabs remix rejects missing eligibility before transport and materializes non-recursive lineage', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.path.endsWith('/remix')) return { previews: [{ generated_voice_id: 'candidate-1', audio_base_64: 'AQID' }] } as T
      if (input.path === '/v1/text-to-voice') return { voice_id: 'voice-materialized' } as T
      throw new Error(`Unexpected request ${input.path}`)
    }
    const adapter = createElevenLabsAdvancedProvider({ apiKey: 'account-key', request, now: () => CHECKED_AT })
    const sourceVoice = accountVoice('elevenlabs', 'source-voice', adapter.accountScopeHash)
    const base = { description: 'A warm and grounded documentary narrator.', previewText: 'A'.repeat(120), candidateCount: 1, creationModel: 'eleven_v3', sourceVoice }
    await expect(adapter.design!.createCandidate(base)).rejects.toThrow('eligibility snapshot hash')
    expect(calls).toHaveLength(0)
    const eligibilitySnapshotHash = 'e'.repeat(64)
    const designed = await adapter.design!.createCandidate({ ...base, eligibilitySnapshotHash })
    expect(designed.operation).toBe('remix')
    const materialized = await adapter.design!.materializeCandidate({ providerCandidateId: designed.previews[0]!.providerCandidateId, desiredName: 'Remixed Guide', localAttemptId: 'attempt-remix-1', sourceVoice, eligibilitySnapshotHash })
    expect(materialized.providerVoice).toEqual(expect.objectContaining({ resourceId: 'voice-materialized', origin: 'remixed' }))
    expect(materialized.providerVoice?.kind === 'remote-resource' ? materialized.providerVoice.derivedFrom : undefined).toEqual(expect.objectContaining({
      sourceRef: 'source-voice',
      sourceIdentityHash: hashCanonicalTtsValue(sourceVoice),
      eligibilitySnapshotHash
    }))
    expect(() => validateProviderVoiceRef(materialized.providerVoice as ProviderVoiceRef)).not.toThrow()
    expect(calls.map(call => call.path)).toEqual(['/v1/text-to-voice/source-voice/remix', '/v1/text-to-voice'])
  })

  test('clone adapters report API-ready and external verification states without inventing support', async () => {
    let elevenCalls = 0
    const eleven = createElevenLabsAdvancedProvider({
      apiKey: 'account-key',
      now: () => CHECKED_AT,
      resolveProtectedAsset: async () => ({ bytes: new Uint8Array([1, 2, 3]), fileName: 'sample.wav', mediaType: 'audio/wav' }),
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        elevenCalls++
        expect(input.body).toBeInstanceOf(FormData)
        return { voice_id: 'instant-clone-1' } as T
      }
    })
    const protectedSample = { storeId: 'voice_store', assetId: `sha256_${'a'.repeat(64)}`, sha256: 'a'.repeat(64) }
    const instant = await eleven.clone!.clone({ cloneKind: 'instant', desiredName: 'Clone', localAttemptId: 'attempt-clone', protectedSamples: [protectedSample], consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:release' })
    expect(instant).toEqual(expect.objectContaining({ state: 'ready', providerVoice: expect.objectContaining({ resourceId: 'instant-clone-1', origin: 'instant-clone' }) }))
    const professional = await eleven.clone!.clone({ cloneKind: 'professional', desiredName: 'PVC', localAttemptId: 'attempt-pvc', protectedSamples: [], consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:release' })
    expect(professional.state).toBe('verification-required')
    expect(elevenCalls).toBe(1)

    let humeCalls = 0
    const hume = createHumeAdvancedProvider({ apiKey: 'hume-key', request: async <T>(): Promise<T> => { humeCalls++; return {} as T }, now: () => CHECKED_AT })
    const humeClone = await hume.clone!.clone({ cloneKind: 'instant', desiredName: 'Hume Clone', localAttemptId: 'attempt-hume', protectedSamples: [protectedSample], consentRecordRef: 'protected-consent:v1:test', provenanceRef: 'project:release' })
    expect(humeClone).toEqual(expect.objectContaining({ state: 'external-action-required', action: expect.stringContaining('Hume platform') }))
    expect(humeCalls).toBe(0)
  })

  test('Hume deletion requires a fresh unique name-to-ID proof before the name-based endpoint', async () => {
    const calls: Parameters<AdvancedProviderHttpRequest>[0][] = []
    const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
      calls.push(input)
      if (input.method === 'POST') return { id: 'custom-delete' } as T
      if (input.method === 'GET') return [{ id: 'custom-delete', name: 'Delete Me', provider: 'CUSTOM_VOICE' }] as T
      return undefined as T
    }
    const adapter = createHumeAdvancedProvider({ apiKey: 'hume-key', request, now: () => CHECKED_AT })
    const result = await adapter.design!.materializeCandidate({ providerCandidateId: 'generation-1', desiredName: 'Delete Me', localAttemptId: 'attempt-design' })
    const voice = result.providerVoice as Extract<ProviderVoiceRef, { kind: 'remote-resource' }>
    await adapter.lifecycle!.delete({ providerVoice: voice, expectedResourceId: 'custom-delete', expectedName: 'Delete Me' })
    expect(calls.at(-1)).toEqual(expect.objectContaining({ method: 'DELETE', path: '/v0/tts/voices', query: { name: 'Delete Me' } }))

    let deleteCalled = false
    const ambiguous = createHumeAdvancedProvider({
      apiKey: 'hume-key',
      now: () => CHECKED_AT,
      request: async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]): Promise<T> => {
        if (input.method === 'DELETE') deleteCalled = true
        return [{ id: 'custom-delete', name: 'Delete Me', provider: 'CUSTOM_VOICE' }, { id: 'other', name: 'Delete Me', provider: 'CUSTOM_VOICE' }] as T
      }
    })
    await expect(ambiguous.lifecycle!.delete({ providerVoice: voice, expectedResourceId: 'custom-delete', expectedName: 'Delete Me' })).rejects.toThrow('unique name-to-expected-ID proof')
    expect(deleteCalled).toBe(false)
  })

  test('advanced candidates retain protected previews and materialize through one durable journal', async () => {
    const root = await makeRoot()
    const charactersRoot = join(root, 'characters')
    const store = createProtectedVoiceAssetStore({ storeId: 'phase3_voice_store', root: join(root, 'protected') })
    const accountScopeHash = 'c'.repeat(64)
    const providerVoice: Extract<ProviderVoiceRef, { kind: 'remote-resource' }> = {
      kind: 'remote-resource', provider: 'hume', resourceId: 'saved-design', namespace: 'account', accountScopeHash,
      origin: 'designed', ownership: 'project', deletion: { state: 'eligible', checkedAt: CHECKED_AT }
    }
    let materializeCalls = 0
    const provider: Pick<TtsVoiceProvider, 'provider' | 'design'> & { accountScopeHash: string } = {
      provider: 'hume',
      accountScopeHash,
      design: {
        createCandidate: async () => ({ schemaVersion: 1, provider: 'hume', operation: 'design', creationModel: 'octave-1', previews: [{ providerCandidateId: 'generation-design', audioBase64: 'AQID', mediaType: 'audio/mpeg', sanitizedMetadata: {} }], checkedAt: CHECKED_AT }),
        materializeCandidate: async () => {
          materializeCalls++
          return { schemaVersion: 1, provider: 'hume', state: 'ready', providerVoice, sanitizedMetadata: {}, checkedAt: CHECKED_AT }
        }
      }
    }
    const candidates = await createAdvancedVoiceCandidates({ charactersRoot, protectedStore: store, provider, providerModel: 'octave-2', creationModel: 'octave-1', subjectKey: 'guide', profileKey: 'default', description: 'Warm guide', previewText: 'A'.repeat(120), candidateCount: 1, now: () => CHECKED_AT })
    expect(candidates[0]).toEqual(expect.objectContaining({ providerCandidateId: 'generation-design', materialization: { state: 'not-materialized' } }))
    const brief: CharacterVoiceBrief = { subjectKey: 'guide', profileKey: 'default', mannerisms: [], prohibitedCaricatures: [], pronunciations: [], allowedOrigins: ['designed'] }
    const result = await materializeAdvancedVoiceCandidate({ charactersRoot, journalRoot: join(root, 'journals'), protectedStore: store, provider, candidateId: candidates[0]!.candidateId, desiredName: 'Guide', subjectKey: 'guide', profileKey: 'default', brief, provenanceRef: 'project:casting', capabilityFixtureHash: HUME_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash, now: () => CHECKED_AT })
    expect(result.candidate.candidateId).not.toBe(candidates[0]!.candidateId)
    expect(result.candidate.materialization.state).toBe('materialized')
    expect(result.registration.provisioning.state).toBe('ready')
    expect(materializeCalls).toBe(1)
  })
})

describe('Phase 3 native planning, prepared text, timing, and continuation', () => {
  test('shared render planning selects ElevenLabs dialogue and Hume utterances with supported controls', () => {
    const elevenTarget: TtsTarget = { service: 'elevenlabs', model: 'eleven_v3', run: async () => { throw new Error('planning must not dispatch') } }
    const elevenTurns = Array.from({ length: 11 }, (_, index) => ({ turnId: `turn-${index}`, speaker: `SPEAKER_${index}`, text: 'hello' }))
    const eleven = planCurrentTtsReadiness({
      target: elevenTarget,
      sourceText: elevenTurns.map(turn => `${turn.speaker}: ${turn.text}`).join('\n'),
      ttsOptions: {
        ttsDialogueFormat: 'labeled',
        ttsSpeakers: elevenTurns.map((turn, index) => `${turn.speaker}=voice-${index}`),
        ttsCanonicalTurns: elevenTurns
      }
    })
    expect(eleven.strategy).toBe('native-dialogue')
    expect(eleven.renderPlan.batches.map(batch => batch.orderedTurnIds.length)).toEqual([10, 1])

    const humeTarget: TtsTarget = { service: 'hume', model: 'octave-2', run: async () => { throw new Error('planning must not dispatch') } }
    const hume = planCurrentTtsReadiness({
      target: humeTarget,
      sourceText: 'HERO: Hello\nGUIDE: Go.',
      ttsOptions: {
        ttsDialogueFormat: 'labeled',
        ttsSpeakers: ['HERO=voice-a', 'GUIDE=voice-b'],
        ttsCanonicalTurns: [{ turnId: 'dialogue-turn-001', speaker: 'HERO', text: 'Hello' }, { turnId: 'dialogue-turn-002', speaker: 'GUIDE', text: 'Go.' }],
        ttsTurnControls: {
          'dialogue-turn-001': { hume: { speed: 1.1 } },
          'dialogue-turn-002': { hume: { trailingSilence: 0.2 } }
        }
      }
    })
    expect(hume.strategy).toBe('native-utterances')
    expect(hume.renderPlan.nodes).toEqual([
      expect.objectContaining({ kind: 'turn', turn: expect.objectContaining({ turnId: 'dialogue-turn-001' }) }),
      expect.objectContaining({ kind: 'turn', turn: expect.objectContaining({ turnId: 'dialogue-turn-002' }) })
    ])
  })

  test('ElevenLabs partitions only at turn boundaries for character and per-request voice limits', () => {
    const voices = Array.from({ length: 11 }, (_, index) => ({ turnId: `turn-${index}`, subjectKey: `subject-${index}`, speaker: `Speaker ${index}`, canonicalText: 'hello', voiceId: `voice-${index}` }))
    const voiceBatches = planElevenLabsNativeDialogueBatches(voices)
    expect(voiceBatches.map(batch => batch.turns.length)).toEqual([10, 1])
    const characterBatches = planElevenLabsNativeDialogueBatches([
      { turnId: 'one', subjectKey: 'one', speaker: 'One', canonicalText: '12345', voiceId: 'voice-one' },
      { turnId: 'two', subjectKey: 'two', speaker: 'Two', canonicalText: '67890', voiceId: 'voice-two' }
    ], 8)
    expect(characterBatches.map(batch => batch.turns.map(turn => turn.turnId))).toEqual([['one'], ['two']])
    expect(() => planElevenLabsNativeDialogueBatches([{ turnId: 'long', subjectKey: 'long', speaker: 'Long', canonicalText: '123456789', voiceId: 'voice' }], 8)).toThrow('turn-safe boundary')
  })

  test('ElevenLabs delivery tags retain scalar source maps and provider alignment maps back to turns', () => {
    const prepared = prepareElevenLabsDialogueText('Hi 👋', 'softly')
    expect(prepared.providerText).toBe('[whispers] Hi 👋')
    expect(prepared.spans).toEqual([
      { kind: 'provider-only', providerStart: 0, providerEnd: 11, transform: 'v3-delivery-audio-tag' },
      { kind: 'mapped', canonicalStart: 0, canonicalEnd: 4, providerStart: 11, providerEnd: 15 }
    ])
    const batches = planElevenLabsNativeDialogueBatches([
      { turnId: 'one', subjectKey: 'hero', speaker: 'Hero', canonicalText: 'Hi 👋', voiceId: 'voice-1', delivery: 'softly' },
      { turnId: 'two', subjectKey: 'guide', speaker: 'Guide', canonicalText: 'Go.', voiceId: 'voice-2' }
    ])
    const turns = batches[0]!.turns
    const providerCharacters = turns.flatMap(turn => [...turn.preparedText.providerText])
    const secondStart = [...turns[0]!.preparedText.providerText].length
    const timing = normalizeElevenLabsDialogueTiming({
      turns,
      response: {
        voice_segments: [
          { dialogue_input_index: 0, start_time_seconds: 0, end_time_seconds: 0.8, character_start_index: 0, character_end_index: secondStart },
          { dialogue_input_index: 1, start_time_seconds: 0.8, end_time_seconds: 1.2, character_start_index: secondStart, character_end_index: providerCharacters.length }
        ],
        alignment: {
          characters: providerCharacters,
          character_start_times_seconds: providerCharacters.map((_, index) => index / 10),
          character_end_times_seconds: providerCharacters.map((_, index) => (index + 1) / 10)
        }
      }
    })
    expect(timing.availability).toBe('timed')
    if (timing.availability !== 'timed') throw new Error('expected timing')
    expect(timing.turns).toEqual([
      { turnId: 'one', subjectKey: 'hero', startMs: 0, endMs: 800 },
      { turnId: 'two', subjectKey: 'guide', startMs: 800, endMs: 1200 }
    ])
    expect(timing.characters?.find(character => character.text === '[')?.canonicalStart).toBeUndefined()
    expect(timing.characters?.find(character => character.text === 'H')?.canonicalStart).toBe(0)
    expect(timing.characters?.find(character => character.turnId === 'two')?.providerStart).toBe(0)
  })

  test('ElevenLabs delivery tags serialize only documented bounded controls and never arbitrary stage prose', () => {
    const prepared = prepareElevenLabsDialogueText('Ready.', 'Relaxed, low-key, and casually precise; shifts into focused pilot mode — never rushed/forced')
    expect(prepared.providerText).toBe('Ready.')
    expect(prepared.spans).toEqual([
      { kind: 'mapped', canonicalStart: 0, canonicalEnd: 6, providerStart: 0, providerEnd: 6 }
    ])

    expect(prepareElevenLabsDialogueText('No.', 'quietly indignant').providerText).toBe('[whispers] [angry] No.')
    expect(prepareElevenLabsDialogueText('Hold on.', 'exhaling, filing this away for later').providerText).toBe('[exhales] Hold on.')
  })

  test('Hume enforces Octave 2 direction constraints and maps nested word/phoneme timestamps to source turns', () => {
    expect(() => planHumeNativeUtteranceBatches([{ turnId: 'one', subjectKey: 'hero', speaker: 'Hero', canonicalText: 'Hello', voiceId: 'voice', delivery: 'whispering' }])).toThrow('cannot serialize required acting descriptions')
    const batches = planHumeNativeUtteranceBatches([
      { turnId: 'one', subjectKey: 'hero', speaker: 'Hero', canonicalText: '12345', voiceId: 'voice-1', speed: 1.1 },
      { turnId: 'two', subjectKey: 'guide', speaker: 'Guide', canonicalText: '67890', voiceId: 'voice-2', trailingSilence: 0.2 }
    ], 8)
    expect(batches.map(batch => batch.turns.map(turn => turn.turnId))).toEqual([['one'], ['two']])
    const timing = normalizeHumeGenerationTiming({
      turns: batches.flatMap(batch => batch.turns),
      generation: {
        duration: 1,
        snippets: [[
          { utterance_index: 0, timestamps: [{ type: 'word', text: 'Hello', time: { begin: 0, end: 400 } }, { type: 'phoneme', text: 'h', time: { begin: 0, end: 50 } }] },
          { utterance_index: 1, timestamps: [{ type: 'word', text: 'Go', time: { begin: 500, end: 900 } }, { type: 'phoneme', text: 'g', time: { begin: 500, end: 550 } }] }
        ]]
      }
    })
    expect(timing.availability).toBe('timed')
    if (timing.availability !== 'timed') throw new Error('expected timing')
    expect(timing.turns).toEqual([
      { turnId: 'one', subjectKey: 'hero', startMs: 0, endMs: 400 },
      { turnId: 'two', subjectKey: 'guide', startMs: 500, endMs: 900 }
    ])
    expect(timing.words?.map(word => word.turnId)).toEqual(['one', 'two'])
    expect(timing.phonemes?.map(phoneme => phoneme.turnId)).toEqual(['one', 'two'])
  })

  test('Hume continuation accepts only the selected same-version generation checkpoint', () => {
    const continuation = {
      kind: 'checkpoint' as const,
      source: 'prior-batch' as const,
      checkpointId: 'checkpoint-1',
      checkpointRef: 'checkpoints/checkpoint-1.json',
      checkpointSha256: 'a'.repeat(64),
      predecessorBatchId: 'batch-1',
      batchResultId: 'result-1',
      selectionId: 'selection-1',
      selectedTakeId: 'take-1',
      provider: 'hume' as const,
      model: 'octave-2',
      providerVersion: '2',
      continuationState: { kind: 'provider-generation-id' as const, value: 'generation-1' }
    }
    expect(() => validateHumeContinuation(continuation, '2')).not.toThrow()
    expect(() => validateHumeContinuation({ ...continuation, providerVersion: '1' }, '2')).toThrow('cannot consume')
    expect(() => validateHumeContinuation({ ...continuation, provider: 'elevenlabs' }, '2')).toThrow('another provider')
    expect(() => validateHumeContinuation({ ...continuation, continuationState: { kind: 'provider-generation-id', value: '' } }, '2')).toThrow('selected prior generation ID')
  })

  test('ElevenLabs final native serializer retains ordered voice IDs and timing evidence', async () => {
    const root = await makeRoot()
    const priorFetch = globalThis.fetch
    const priorKey = process.env['ELEVENLABS_API_KEY']
    const observations: TtsSerializedRequestObservation[] = []
    const outputTiming: unknown[] = []
    const audio = createMockWavBase64({ samples: 800 })
    process.env['ELEVENLABS_API_KEY'] = 'test-key'
    globalThis.fetch = (async () => new Response(JSON.stringify({
      audio_base64: audio,
      voice_segments: [
        { dialogue_input_index: 0, start_time_seconds: 0, end_time_seconds: 0.05, character_start_index: 0, character_end_index: 5 },
        { dialogue_input_index: 1, start_time_seconds: 0.05, end_time_seconds: 0.1, character_start_index: 5, character_end_index: 8 }
      ],
      alignment: {
        characters: [...'HelloGo.'],
        character_start_times_seconds: Array.from({ length: 8 }, (_, index) => index * 0.01),
        character_end_times_seconds: Array.from({ length: 8 }, (_, index) => (index + 1) * 0.01)
      }
    }), { headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch
    const evidence: TtsRequestEvidenceScope = {
      dispatch: async (observation, _attempt, operation) => {
        observations.push(observation)
        return await operation({ accepted: async () => {} })
      },
      recordOutput: async output => { outputTiming.push(output.timing) },
      complete: async () => {}
    }
    try {
      const result = await runElevenLabsNativeDialogue([
        { turnId: 'one', subjectKey: 'hero', speaker: 'Hero', canonicalText: 'Hello', voiceId: 'voice-a' },
        { turnId: 'two', subjectKey: 'guide', speaker: 'Guide', canonicalText: 'Go.', voiceId: 'voice-b' }
      ], root, { model: 'eleven_v3', requestEvidence: evidence })
      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(observations).toHaveLength(1)
      expect(observations[0]).toEqual(expect.objectContaining({
        endpointKind: 'text-to-dialogue-with-timestamps',
        voiceField: 'inputs[].voice_id',
        voices: [
          { kind: 'provider-id', value: 'voice-a', speaker: 'Hero' },
          { kind: 'provider-id', value: 'voice-b', speaker: 'Guide' }
        ],
        serializedRequest: expect.objectContaining({ body: expect.objectContaining({ inputs: [{ text: 'Hello', voice_id: 'voice-a' }, { text: 'Go.', voice_id: 'voice-b' }] }) })
      }))
      expect(outputTiming[0]).toEqual(expect.objectContaining({ availability: 'timed', provenance: 'provider-alignment' }))
    } finally {
      globalThis.fetch = priorFetch
      if (priorKey === undefined) delete process.env['ELEVENLABS_API_KEY']
      else process.env['ELEVENLABS_API_KEY'] = priorKey
    }
  })

  test('Hume native serializer returns bounded takes and continues from the selected first generation', async () => {
    const root = await makeRoot()
    const priorFetch = globalThis.fetch
    const priorKey = process.env['HUME_API_KEY']
    const bodies: Array<Record<string, unknown>> = []
    const audio = createMockWavBase64({ samples: 800 })
    process.env['HUME_API_KEY'] = 'test-key'
    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      bodies.push(body)
      const batch = bodies.length
      return new Response(JSON.stringify({ generations: [
        { generation_id: `batch-${batch}-selected`, audio, duration: 0.05 },
        { generation_id: `batch-${batch}-alternate`, audio, duration: 0.05 }
      ] }), { headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
    try {
      const result = await runHumeNativeUtterances([
        { turnId: 'one', subjectKey: 'hero', speaker: 'Hero', canonicalText: 'A'.repeat(3000), voiceId: 'voice-a', speed: 1.1 },
        { turnId: 'two', subjectKey: 'guide', speaker: 'Guide', canonicalText: 'B'.repeat(3000), voiceId: 'voice-b', trailingSilence: 0.2 }
      ], root, { model: 'octave-2', takeCount: 2 })
      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(bodies).toHaveLength(2)
      expect(bodies[0]).toEqual(expect.objectContaining({ version: '2', num_generations: 2, utterances: [expect.objectContaining({ voice: { id: 'voice-a' }, speed: 1.1 })] }))
      expect(bodies[1]).toEqual(expect.objectContaining({ context: { generation_id: 'batch-1-selected' }, utterances: [expect.objectContaining({ voice: { id: 'voice-b' }, trailing_silence: 0.2 })] }))
    } finally {
      globalThis.fetch = priorFetch
      if (priorKey === undefined) delete process.env['HUME_API_KEY']
      else process.env['HUME_API_KEY'] = priorKey
    }
  })
})
