import type { NormalizedTiming, TtsRequestEvidenceScope, TtsSerializedRequestObservation } from '~/types'
import { describe, expect, test } from 'bun:test'
import {
  FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION,
  FISH_TIMESTAMP_SERIALIZER_VERSION,
  normalizeFishNativeDialogueTiming,
  normalizeFishTimestampAlignment,
  parseFishSseFrame,
  planFishNativeDialogueBatches,
  prepareFishDialogueText,
  reduceFishTimestampStreamEvent,
  emptyFishTimestampStreamState,
  buildFishGlobalTimeline,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/fish/fish-tts-request'
import { runFishNativeDialogue } from '~/cli/commands/process-steps/step-4-tts/tts-services/fish/fish-native-dialogue'
import { runFishTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/fish/run-fish-tts'
import { createFishAdvancedProvider } from '~/cli/commands/process-steps/step-4-tts/tts-services/fish/fish-advanced-provider'
import { createMockWavBase64, createMockWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['FISH_API_KEY'],
  tempPrefix: 'autoshow-fish-timing-'
})

const sse = (event: unknown): string => `data: ${JSON.stringify(event)}\n\n`

describe('Fish timestamp stream reduction', () => {
  test('replaces the latest alignment snapshot by chunk_seq instead of accumulating', () => {
    let state = emptyFishTimestampStreamState()
    state = reduceFishTimestampStreamEvent(state, {
      audio_base64: Buffer.from('aa').toString('base64'),
      content: 'Hello',
      chunk_seq: 0,
      chunk_audio_offset_sec: 0,
      alignment: { audio_duration: 0.2, segments: [{ text: 'He', start: 0, end: 0.1 }] },
    })
    state = reduceFishTimestampStreamEvent(state, {
      audio_base64: Buffer.from('bb').toString('base64'),
      content: 'Hello',
      chunk_seq: 0,
      chunk_audio_offset_sec: 0,
      alignment: { audio_duration: 0.4, segments: [{ text: 'Hello', start: 0, end: 0.4 }] },
    })
    state = reduceFishTimestampStreamEvent(state, {
      audio_base64: Buffer.from('cc').toString('base64'),
      content: 'world',
      chunk_seq: 1,
      chunk_audio_offset_sec: 0.4,
      alignment: { audio_duration: 0.3, segments: [{ text: 'world', start: 0, end: 0.3 }] },
    })
    expect(state.alignmentByChunk.size).toBe(2)
    expect(state.alignmentByChunk.get(0)?.alignment.segments).toEqual([{ text: 'Hello', start: 0, end: 0.4 }])
    expect(buildFishGlobalTimeline(state.alignmentByChunk)).toEqual([
      { text: 'Hello', start: 0, end: 0.4, chunkSeq: 0 },
      { text: 'world', start: 0.4, end: 0.7, chunkSeq: 1 },
    ])
    expect(Buffer.concat(state.audioChunks.map(chunk => Buffer.from(chunk))).toString()).toBe('aabbcc')
  })

  test('rejects malformed SSE JSON before any audio is treated as success', () => {
    expect(() => parseFishSseFrame('data: {not-json}\n')).toThrow('malformed SSE JSON')
    expect(() => parseFishSseFrame('data: {"content":"x","alignment":null,"chunk_seq":0,"chunk_audio_offset_sec":0}\n')).toThrow('audio_base64')
  })

  test('plans S2 Pro speaker tags and maps delivery markers through prepared text', () => {
    const batches = planFishNativeDialogueBatches([
      { turnId: 't1', subjectKey: 'pilot', speaker: 'PILOT', canonicalText: 'Ready?', voiceId: 'voice-a', delivery: 'whispering' },
      { turnId: 't2', subjectKey: 'navigator', speaker: 'NAVIGATOR', canonicalText: 'Ready.', voiceId: 'voice-b' },
    ])
    expect(batches).toHaveLength(1)
    expect(batches[0]?.providerText).toBe('<|speaker:0|>[whispering] Ready?<|speaker:1|>Ready.')
    expect(batches[0]?.referenceIds).toEqual(['voice-a', 'voice-b'])
    expect(prepareFishDialogueText('Ready?', 'happy', 's2.1-pro').providerText).toBe('[happy] Ready?')
  })
})

describe('Fish timestamped synthesis contracts', () => {
  test('serializes s2.1-pro timestamp streaming and binds alignment to the planned turn', async () => {
    const root = await tempDirs.make()
    const observations: TtsSerializedRequestObservation[] = []
    const timings: Array<NormalizedTiming<'take-audio-ms'>> = []
    const evidence: TtsRequestEvidenceScope = {
      dispatch: async (observation, _attempt, operation) => {
        observations.push(observation)
        return await operation({ accepted: async () => {} })
      },
      recordOutput: async output => {
        if (output.timingFactory) timings.push(output.timingFactory({ turnId: 'turn-7', subjectKey: 'narrator' }))
      },
      complete: async () => {},
    }
    const audio = createMockWavBase64()
    installMockFetch(() => new Response(sse({
      audio_base64: audio,
      content: 'Ready?',
      chunk_seq: 0,
      chunk_audio_offset_sec: 0,
      alignment: { audio_duration: 0.05, segments: [{ text: 'Ready?', start: 0, end: 0.05 }] },
    }), { status: 200, headers: { 'content-type': 'text/event-stream', 'x-request-id': 'fish-ts-1' } }))
    await runFishTts('Ready?', root, { model: 's2.1-pro', apiKey: 'local-test-key', voiceId: '7f92f8afb8ec43bf81429cc1c9199cb1', requestEvidence: evidence })
    expect(observations[0]).toMatchObject({
      serializerVersion: FISH_TIMESTAMP_SERIALIZER_VERSION,
      endpointKind: 'text-to-speech-stream-with-timestamps',
      serializedRequest: { path: '/v1/tts/stream/with-timestamp', body: { text: 'Ready?', reference_id: '7f92f8afb8ec43bf81429cc1c9199cb1', format: 'wav' } },
    })
    expect(timings[0]).toMatchObject({
      availability: 'timed',
      words: [{ text: 'Ready?', startMs: 0, endMs: 50, turnId: 'turn-7', subjectKey: 'narrator' }],
    })
  })

  test('native dialogue records complete timing and rejects non-s2 models', async () => {
    await expect(runFishNativeDialogue([{ turnId: 't1', subjectKey: 'pilot', speaker: 'PILOT', canonicalText: 'Hi', voiceId: 'v1' }], 'unused', {
      model: 'voice-design-1',
      apiKey: 'local-test-key',
    })).rejects.toThrow('requires model s2.1-pro')

    const root = await tempDirs.make()
    const observations: TtsSerializedRequestObservation[] = []
    const timings: Array<NormalizedTiming<'take-audio-ms'>> = []
    const evidence: TtsRequestEvidenceScope = {
      dispatch: async (observation, _attempt, operation) => {
        observations.push(observation)
        return await operation({ accepted: async () => {} })
      },
      recordOutput: async output => { if (output.timing) timings.push(output.timing) },
      complete: async () => {},
    }
    const audio = createMockWavBase64()
    installMockFetch(() => new Response([
      sse({ audio_base64: audio, content: 'Hi there', chunk_seq: 0, chunk_audio_offset_sec: 0, alignment: null }),
      sse({
        audio_base64: audio,
        content: 'Hi there',
        chunk_seq: 0,
        chunk_audio_offset_sec: 0,
        alignment: { audio_duration: 0.4, segments: [{ text: 'Hi', start: 0, end: 0.16 }, { text: 'there', start: 0.16, end: 0.4 }] },
      }),
    ].join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } }))
    await runFishNativeDialogue([
      { turnId: 't1', subjectKey: 'pilot', speaker: 'PILOT', canonicalText: 'Hi', voiceId: 'voice-a' },
      { turnId: 't2', subjectKey: 'navigator', speaker: 'NAVIGATOR', canonicalText: 'there', voiceId: 'voice-b' },
    ], root, { model: 's2.1-pro', apiKey: 'local-test-key', requestEvidence: evidence })
    expect(observations[0]).toMatchObject({
      serializerVersion: FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION,
      serializedRequest: { body: { text: '<|speaker:0|>Hi<|speaker:1|>there', reference_id: ['voice-a', 'voice-b'], format: 'wav' } },
    })
    expect(timings[0]?.availability).toBe('timed')
  })

  test('interrupts a timestamp stream when the abort signal fires', async () => {
    const root = await tempDirs.make()
    const controller = new AbortController()
    installMockFetch((_call, _input, init) => {
      controller.abort()
      init?.signal?.throwIfAborted()
      return new Response(sse({ audio_base64: createMockWavBase64(), content: 'Hi', chunk_seq: 0, chunk_audio_offset_sec: 0, alignment: null }), { status: 200 })
    })
    await expect(runFishTts('Ready?', root, {
      model: 's2.1-pro',
      apiKey: 'local-test-key',
      abortSignal: controller.signal,
    })).rejects.toThrow()
  })

  test('normalizes native dialogue words onto canonical offsets', () => {
    const batches = planFishNativeDialogueBatches([
      { turnId: 't1', subjectKey: 'pilot', speaker: 'PILOT', canonicalText: 'Hi', voiceId: 'a' },
      { turnId: 't2', subjectKey: 'navigator', speaker: 'NAVIGATOR', canonicalText: 'there', voiceId: 'b' },
    ])
    const timing = normalizeFishNativeDialogueTiming({
      turns: batches[0]!.turns,
      timeline: [
        { text: 'Hi', start: 0, end: 0.16, chunkSeq: 0 },
        { text: 'there', start: 0.16, end: 0.4, chunkSeq: 0 },
      ],
    })
    expect(timing).toMatchObject({
      availability: 'timed',
      words: [
        { turnId: 't1', text: 'Hi', canonicalStart: 0, canonicalEnd: 2, startMs: 0, endMs: 160 },
        { turnId: 't2', text: 'there', canonicalStart: 0, canonicalEnd: 5, startMs: 160, endMs: 400 },
      ],
    })
    expect(normalizeFishTimestampAlignment({
      text: 'Ready?',
      identity: { turnId: 'turn-1', subjectKey: 'pilot' },
      timeline: [],
    }).availability).toBe('unavailable')
  })
})

describe('Fish voice design and clone adapter contracts', () => {
  test('ingests every documented voice-design-1 candidate and rejects professional clone', async () => {
    const audio = createMockWavBytes()
    const provider = createFishAdvancedProvider({
      apiKey: 'test-fish-key',
      resolveProtectedAsset: async () => ({ bytes: audio, fileName: 'sample.wav', mediaType: 'audio/wav' }),
      fetchImpl: (async (input: string | URL | Request) => {
        const url = String(input)
        if (url.includes('/voice-design')) {
          return Response.json({
            candidates: [
              { id: 'cand-0', index: 0, audio_base64: audio.toString('base64'), sample_rate: 44100, duration_ms: 1200 },
              { id: 'cand-1', index: 1, audio_base64: audio.toString('base64'), sample_rate: 44100, duration_ms: 1300 },
            ],
          })
        }
        return new Response('not found', { status: 404 })
      }) as unknown as typeof fetch,
    })
    const designed = await provider.design!.createCandidate({
      description: 'Warm, weathered guide',
      previewText: 'A short representative passage.',
      creationModel: 'voice-design-1',
      candidateCount: 2,
      seed: 42,
    })
    expect(designed.previews).toHaveLength(2)
    expect(designed.previews[0]).toMatchObject({ providerCandidateId: 'cand-0', sanitizedMetadata: { candidateIndex: 0, sampleRate: 44100, seed: 42 } })
    await expect(provider.clone!.clone({
      cloneKind: 'professional',
      desiredName: 'Hero',
      localAttemptId: 'attempt-1',
      protectedSamples: [{ storeId: 'store', assetId: 'asset', sha256: 'a'.repeat(64) }],
      consentRecordRef: 'consent',
      provenanceRef: 'prov',
    })).rejects.toThrow('does not document a professional voice-clone workflow')
  })
})
