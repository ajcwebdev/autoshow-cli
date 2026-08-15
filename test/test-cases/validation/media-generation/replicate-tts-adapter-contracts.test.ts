import type { TtsRequestEvidenceScope, TtsSerializedRequestObservation, TtsTargetInvocation } from '~/types'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectReplicateTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-replicate/replicate-tts-targets'
import {
  REPLICATE_KOKORO_MODEL_ID,
  REPLICATE_KOKORO_SERIALIZER_VERSION,
  REPLICATE_KOKORO_TTS_FIXTURE,
  REPLICATE_KOKORO_VERSION,
  runReplicateTts,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-replicate/run-replicate-tts'
import { createReplicateAdvancedProvider, REPLICATE_ADVANCED_CAPABILITY_FIXTURE } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-replicate/replicate-advanced-provider'
import { resolveTtsTargetInvocationVoice } from '~/cli/commands/process-steps/step-4-tts/tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-invocation-controls'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'
import { REPLICATE_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'

const roots: string[] = []
const POLL_URL = 'https://api.replicate.com/v1/predictions/prediction-1'
const OUTPUT_URL = 'https://replicate.delivery/kokoro-output.wav'

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async root => await rm(root, { recursive: true, force: true })))
})

const invocation = (controls: TtsTargetInvocation['controls'], voice: TtsTargetInvocation['voice'] = { kind: 'id', value: 'af_bella' }): TtsTargetInvocation => Object.freeze({
  sourceId: 'dialogue-turn-001',
  sourceIndex: 0,
  speaker: 'PILOT',
  voice: Object.freeze(voice),
  controls: Object.freeze(controls),
})

const evidence = (observations: TtsSerializedRequestObservation[]): TtsRequestEvidenceScope => ({
  dispatch: async (observation, _attempt, operation) => {
    observations.push(observation)
    return await operation({ accepted: async () => {} })
  },
  recordOutput: async () => {},
  complete: async () => {},
})

describe('Replicate Kokoro TTS contracts', () => {
  test('pins a dated Kokoro input and version fixture', () => {
    expect(REPLICATE_KOKORO_TTS_FIXTURE).toMatchObject({
      provider: 'replicate',
      model: REPLICATE_KOKORO_MODEL_ID,
      pinnedVersion: REPLICATE_KOKORO_VERSION,
      endpoint: '/v1/predictions',
      serializerVersion: REPLICATE_KOKORO_SERIALIZER_VERSION,
      inputSchema: { text: 'string', voice: 'stock-voice-id', speed: 'optional-number-0.1-5' },
      defaultVoice: REPLICATE_DEFAULT_TTS_VOICE,
      pricing: { typicalPerPredictionCents: 0.022, inputDependent: true },
    })
    expect(REPLICATE_KOKORO_TTS_FIXTURE.fixtureHash).toMatch(/^[a-f0-9]{64}$/)
  })

  test('collects Replicate TTS targets with the documented default stock voice', () => {
    const named = collectReplicateTtsTargets(createTtsTargetSelection({ replicateTtsModel: REPLICATE_KOKORO_MODEL_ID, replicateTtsVoice: 'am_puck' }))
    expect(named).toHaveLength(1)
    expect(named[0]).toMatchObject({ service: 'replicate', model: REPLICATE_KOKORO_MODEL_ID, voice: 'am_puck' })

    const defaults = collectReplicateTtsTargets(createTtsTargetSelection({ replicateTtsModel: REPLICATE_KOKORO_MODEL_ID }))
    expect(defaults[0]?.voice).toBe('af_bella')
  })

  test('rejects deferred clone and dialogue models plus fabricated stock voices before dispatch', () => {
    expect(() => collectReplicateTtsTargets(createTtsTargetSelection({ replicateTtsModel: 'x-lance/f5-tts' }))).toThrow('Allowed values: jaaari/kokoro-82m')
    expect(() => collectReplicateTtsTargets(createTtsTargetSelection({ replicateTtsModel: 'zsxkib/dia' }))).toThrow('Allowed values: jaaari/kokoro-82m')
    expect(() => collectReplicateTtsTargets(createTtsTargetSelection({ replicateTtsModel: 'lucataco/xtts-v2' }))).toThrow('Allowed values: jaaari/kokoro-82m')
    expect(() => collectReplicateTtsTargets(createTtsTargetSelection({ replicateTtsModel: REPLICATE_KOKORO_MODEL_ID, replicateTtsVoice: 'standard' }))).toThrow('Invalid --replicate-voice value')
    expect(() => resolveTtsTargetInvocationVoice('replicate', invocation({}, { kind: 'ref-audio', value: 'sample.wav' }))).toThrow('does not support reference audio')
  })

  test('serializes only Kokoro speed and rejects unverified controls', () => {
    expect(resolveTtsTargetInvocationControls('replicate', invocation({ speed: 1.1 }), {})).toEqual({ speed: 1.1 })
    expect(() => resolveTtsTargetInvocationControls('replicate', invocation({ instructions: 'whisper' }), {})).toThrow('does not support per-turn TTS invocation control instructions')
    expect(() => resolveTtsTargetInvocationControls('replicate', invocation({ promptInstructions: 'act surprised' }), {})).toThrow('does not support per-turn TTS invocation control promptInstructions')
    expect(() => resolveTtsTargetInvocationControls('replicate', invocation({ speed: 0.05 }), {})).toThrow('must be at least 0.1')
    expect(() => resolveTtsTargetInvocationControls('replicate', invocation({ speed: 5.1 }), {})).toThrow('must be at most 5')
  })

  test('rejects missing credentials instead of fabricating offline audio', async () => {
    await expect(runReplicateTts('Hello from Replicate open-source speech suite test', 'test-out', {
      model: REPLICATE_KOKORO_MODEL_ID,
      apiKey: '',
    })).rejects.toThrow('Replicate API token is required')
  })

  test('rejects out-of-range speed before prediction admission', async () => {
    await expect(runReplicateTts('Too slow.', 'test-out', {
      model: REPLICATE_KOKORO_MODEL_ID,
      apiKey: 'local-mock-key',
      speed: 0.05,
    })).rejects.toThrow('speed must be between 0.1 and 5')
    await expect(runReplicateTts('Too fast.', 'test-out', {
      model: REPLICATE_KOKORO_MODEL_ID,
      apiKey: 'local-mock-key',
      speed: 5.1,
    })).rejects.toThrow('speed must be between 0.1 and 5')
  })

  test('polls a starting prediction then downloads the output before remote expiry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-replicate-kokoro-poll-'))
    roots.push(root)
    const priorFetch = globalThis.fetch
    const calls: Array<{ url: string, method: string, body?: unknown }> = []
    const observations: TtsSerializedRequestObservation[] = []
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) })
      if (url.endsWith('/v1/predictions') && method === 'POST') {
        return Response.json({
          id: 'prediction-1',
          status: 'starting',
          urls: { get: POLL_URL, cancel: `${POLL_URL}/cancel` },
        })
      }
      if (url === POLL_URL) {
        return Response.json({ id: 'prediction-1', status: 'succeeded', output: OUTPUT_URL })
      }
      if (url === OUTPUT_URL) {
        return new Response(createMockWavBytes(), { headers: { 'content-type': 'audio/wav' } })
      }
      throw new Error(`Unexpected network call: ${method} ${url}`)
    }) as typeof fetch
    try {
      const result = await runReplicateTts('Pinned Kokoro request.', root, {
        model: REPLICATE_KOKORO_MODEL_ID,
        apiKey: 'local-mock-key',
        voiceId: 'am_puck',
        speed: 1.1,
        requestEvidence: evidence(observations),
      })
      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toEqual([
        {
          url: 'https://api.replicate.com/v1/predictions',
          method: 'POST',
          body: {
            version: `${REPLICATE_KOKORO_MODEL_ID}:${REPLICATE_KOKORO_VERSION}`,
            input: { text: 'Pinned Kokoro request.', voice: 'am_puck', speed: 1.1 },
          },
        },
        { url: POLL_URL, method: 'GET' },
        { url: OUTPUT_URL, method: 'GET' },
      ])
      expect(observations[0]).toMatchObject({
        endpointKind: 'predictions',
        serializerVersion: REPLICATE_KOKORO_SERIALIZER_VERSION,
        voiceField: 'input.voice',
        serializedRequest: { path: '/v1/predictions' },
      })
    } finally {
      globalThis.fetch = priorFetch
    }
  }, 10_000)

  test('fails empty prediction output and empty downloads instead of fabricating audio', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-replicate-kokoro-empty-'))
    roots.push(root)
    const priorFetch = globalThis.fetch
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).endsWith('/v1/predictions')) {
        return Response.json({ id: 'prediction-empty', status: 'succeeded' })
      }
      throw new Error(`Unexpected network call: ${String(input)}`)
    }) as typeof fetch
    try {
      await expect(runReplicateTts('Missing output.', root, {
        model: REPLICATE_KOKORO_MODEL_ID,
        apiKey: 'local-mock-key',
        voiceId: 'af_bella',
      })).rejects.toThrow('completed without an audio output URL')
    } finally {
      globalThis.fetch = priorFetch
    }

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input)
      if (url.endsWith('/v1/predictions')) {
        return Response.json({ id: 'prediction-blank', status: 'succeeded', output: OUTPUT_URL })
      }
      if (url === OUTPUT_URL) {
        return new Response(new Uint8Array(), { headers: { 'content-type': 'audio/wav' } })
      }
      throw new Error(`Unexpected network call: ${url}`)
    }) as typeof fetch
    try {
      await expect(runReplicateTts('Empty download.', root, {
        model: REPLICATE_KOKORO_MODEL_ID,
        apiKey: 'local-mock-key',
        voiceId: 'af_bella',
      })).rejects.toThrow('audio download was empty')
    } finally {
      globalThis.fetch = priorFetch
    }
  }, 10_000)

  test('advanced provider declares unsupported management facets without fake catalog entries', () => {
    expect(REPLICATE_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createReplicateAdvancedProvider({ apiKey: 'test-key-replicate' })
    expect(provider.catalog).toBeUndefined()
    expect(provider.design).toBeUndefined()
    expect(provider.clone).toBeUndefined()
    expect(provider.lifecycle).toBeUndefined()
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'voice-catalog')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'native-dialogue')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'instant-clone')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'voice-design')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
  })
})
