import type { TtsRequestEvidenceScope, TtsSerializedRequestObservation } from '~/types'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectReplicateTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-replicate/replicate-tts-targets'
import { REPLICATE_KOKORO_VERSION, runReplicateTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-replicate/run-replicate-tts'
import { createReplicateAdvancedProvider, REPLICATE_ADVANCED_CAPABILITY_FIXTURE } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-replicate/replicate-advanced-provider'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async root => await rm(root, { recursive: true, force: true })))
})

describe('Replicate Kokoro TTS contracts', () => {
  test('collects Replicate TTS targets with correct provider and model', () => {
    const selection = createTtsTargetSelection({ replicateTtsModel: 'jaaari/kokoro-82m', replicateTtsVoice: 'am_puck' })
    const targets = collectReplicateTtsTargets(selection)
    expect(targets).toHaveLength(1)
    expect(targets[0]?.service).toBe('replicate')
    expect(targets[0]?.model).toBe('jaaari/kokoro-82m')
    expect(targets[0]?.voice).toBe('am_puck')
  })

  test('rejects retired cloning targets and fabricated stock voices before dispatch', () => {
    expect(() => collectReplicateTtsTargets(createTtsTargetSelection({ replicateTtsModel: 'x-lance/f5-tts' }))).toThrow('Allowed values: jaaari/kokoro-82m')
    expect(() => collectReplicateTtsTargets(createTtsTargetSelection({ replicateTtsModel: 'jaaari/kokoro-82m', replicateTtsVoice: 'standard' }))).toThrow('Invalid --replicate-voice value')
  })

  test('rejects missing credentials instead of fabricating offline audio', async () => {
    await expect(runReplicateTts('Hello from Replicate open-source speech suite test', 'test-out', {
      model: 'jaaari/kokoro-82m',
      apiKey: '',
    })).rejects.toThrow('Replicate API token is required')
  })

  test('pins Kokoro and serializes its exact prediction schema', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-replicate-kokoro-'))
    roots.push(root)
    const priorFetch = globalThis.fetch
    const calls: Array<{ url: string, body?: unknown }> = []
    const observations: TtsSerializedRequestObservation[] = []
    const evidence: TtsRequestEvidenceScope = {
      dispatch: async (observation, _attempt, operation) => {
        observations.push(observation)
        return await operation({ accepted: async () => {} })
      },
      recordOutput: async () => {},
      complete: async () => {}
    }
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = String(input)
      calls.push({ url, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) })
      if (url.endsWith('/v1/predictions')) {
        return Response.json({ id: 'prediction-1', status: 'succeeded', output: 'https://replicate.delivery/kokoro-output.wav' })
      }
      return new Response(createMockWavBytes(), { headers: { 'content-type': 'audio/wav' } })
    }) as typeof fetch
    try {
      const result = await runReplicateTts('Pinned Kokoro request.', root, {
        model: 'jaaari/kokoro-82m',
        apiKey: 'local-mock-key',
        voiceId: 'am_puck',
        speed: 1.1,
        requestEvidence: evidence
      })
      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls[0]).toEqual({
        url: 'https://api.replicate.com/v1/predictions',
        body: {
          version: `jaaari/kokoro-82m:${REPLICATE_KOKORO_VERSION}`,
          input: { text: 'Pinned Kokoro request.', voice: 'am_puck', speed: 1.1 }
        }
      })
      expect(observations[0]).toMatchObject({
        endpointKind: 'predictions',
        serializerVersion: 'replicate.kokoro.v1',
        voiceField: 'input.voice',
        serializedRequest: { path: '/v1/predictions' }
      })
    } finally {
      globalThis.fetch = priorFetch
    }
  }, 10_000)

  test('advanced provider declares unsupported management facets without fake catalog entries', () => {
    expect(REPLICATE_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createReplicateAdvancedProvider({ apiKey: 'test-key-replicate' })
    expect(provider.catalog).toBeUndefined()
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'voice-catalog')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'native-dialogue')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
  })
})
