import { describe, expect, test } from 'bun:test'
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
import { validateProviderVoiceRef } from '~/cli/commands/audio/tts/script-to-audio/contract-validation'
import { planCurrentTtsReadiness } from '~/cli/commands/audio/tts/script-to-audio/current-render-attempt'
import { listInworldVoiceIdsForReadiness } from '~/cli/commands/audio/tts/tts-targets/execution-preflight'
import { hashCanonicalTtsValue } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import {
  createElevenLabsAdvancedProvider,
  ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE,
  ELEVENLABS_DEFAULT_VOICE_EXPIRY,
} from '~/cli/commands/audio/tts/tts-services/tts-elevenlabs/elevenlabs-advanced-provider'
import {
  normalizeElevenLabsDialogueTiming,
  planElevenLabsNativeDialogueBatches,
  prepareElevenLabsDialogueText,
  runElevenLabsNativeDialogue,
} from '~/cli/commands/audio/tts/tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import { createProtectedVoiceAssetStore } from '~/cli/commands/audio/voice/voice-assets/protected-voice-asset-store'
import {
  createAdvancedVoiceCandidates,
  materializeAdvancedVoiceCandidate,
} from '~/cli/commands/audio/voice/advanced-voice-management'
import { createMockWavBase64 } from '../../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle, unexpectedCall } from '../../../../test-utils/rest-contract-helpers'

const CHECKED_AT = '2026-08-11T00:00:00.000Z'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['ELEVENLABS_API_KEY'],
  tempPrefix: 'autoshow-phase-3-'
})

const makeRoot = async (): Promise<string> => await tempDirs.make()

const accountVoice = (
  provider: 'elevenlabs',
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
  test('dated ElevenLabs fixtures load with truthful advanced facets', () => {
    expect(ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash).toHaveLength(64)
    expect(ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE.records.map(record => record.scope.feature)).toContain('native-dialogue')
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

  })

  test('advanced candidates retain protected previews and materialize through one durable journal', async () => {
    const root = await makeRoot()
    const charactersRoot = join(root, 'characters')
    const store = createProtectedVoiceAssetStore({ storeId: 'phase3_voice_store', root: join(root, 'protected') })
    const accountScopeHash = 'c'.repeat(64)
    const providerVoice: Extract<ProviderVoiceRef, { kind: 'remote-resource' }> = {
      kind: 'remote-resource', provider: 'elevenlabs', resourceId: 'saved-design', namespace: 'account', accountScopeHash,
      origin: 'designed', ownership: 'project', deletion: { state: 'eligible', checkedAt: CHECKED_AT }
    }
    let materializeCalls = 0
    const provider: Pick<TtsVoiceProvider, 'provider' | 'design'> & { accountScopeHash: string } = {
      provider: 'elevenlabs',
      accountScopeHash,
      design: {
        createCandidate: async () => ({ schemaVersion: 1, provider: 'elevenlabs', operation: 'design', creationModel: 'eleven_ttv_v3', previews: [{ providerCandidateId: 'generation-design', audioBase64: 'AQID', mediaType: 'audio/mpeg', sanitizedMetadata: {} }], checkedAt: CHECKED_AT }),
        materializeCandidate: async () => {
          materializeCalls++
          return { schemaVersion: 1, provider: 'elevenlabs', state: 'ready', providerVoice, sanitizedMetadata: {}, checkedAt: CHECKED_AT }
        }
      }
    }
    const candidates = await createAdvancedVoiceCandidates({ charactersRoot, protectedStore: store, provider, providerModel: 'eleven_v3', creationModel: 'eleven_ttv_v3', subjectKey: 'guide', profileKey: 'default', description: 'Warm guide', previewText: 'A'.repeat(120), candidateCount: 1, now: () => CHECKED_AT })
    expect(candidates[0]).toEqual(expect.objectContaining({ providerCandidateId: 'generation-design', materialization: { state: 'not-materialized' } }))
    const brief: CharacterVoiceBrief = { subjectKey: 'guide', profileKey: 'default', mannerisms: [], prohibitedCaricatures: [], pronunciations: [], allowedOrigins: ['designed'] }
    const result = await materializeAdvancedVoiceCandidate({ charactersRoot, journalRoot: join(root, 'journals'), protectedStore: store, provider, candidateId: candidates[0]!.candidateId, desiredName: 'Guide', subjectKey: 'guide', profileKey: 'default', brief, provenanceRef: 'project:casting', capabilityFixtureHash: ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash, now: () => CHECKED_AT })
    expect(result.candidate.candidateId).not.toBe(candidates[0]!.candidateId)
    expect(result.candidate.materialization.state).toBe('materialized')
    expect(result.registration.provisioning.state).toBe('ready')
    expect(materializeCalls).toBe(1)
  })
})

describe('Phase 3 native planning, prepared text, timing, and continuation', () => {
  test('shared render planning selects ElevenLabs dialogue native dialogue with supported controls', () => {
    const elevenTarget: TtsTarget = { service: 'elevenlabs', model: 'eleven_v3', run: unexpectedCall('ElevenLabs dispatch during planning') }
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

  test('ElevenLabs final native serializer retains ordered voice IDs and timing evidence', async () => {
    const root = await makeRoot()
    const observations: TtsSerializedRequestObservation[] = []
    const outputTiming: unknown[] = []
    const audio = createMockWavBase64({ samples: 800 })
    process.env['ELEVENLABS_API_KEY'] = 'test-key'
    installMockFetch(() => new Response(JSON.stringify({
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
    }), { headers: { 'content-type': 'application/json' } }))
    const evidence: TtsRequestEvidenceScope = {
      dispatch: async (observation, _attempt, operation) => {
        observations.push(observation)
        return await operation({ accepted: async () => {} })
      },
      recordOutput: async output => { outputTiming.push(output.timing) },
      complete: async () => {}
    }
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
  })

})
