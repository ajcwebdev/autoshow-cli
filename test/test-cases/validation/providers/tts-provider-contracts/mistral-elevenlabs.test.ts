import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test
} from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runElevenLabsTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/run-elevenlabs-tts'
import { runMistralTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-mistral/run-mistral-tts'
import { runTts } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { resolveTtsChunkCharacterLimit } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import type { TtsOptions } from '~/types'
import { createMockWavBase64, createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { LOCAL_AUDIO_PATH, LOCAL_SHORT_AUDIO_PATH, readWavSamples, segmentRms, waitForCondition } from './shared'

const SHORT_AUDIO_URL = 'https://ajc.pics/autoshow/examples/0-audio-short.mp3'

const tempDirs: string[] = []

const originalFetch = globalThis.fetch

const originalSleep = Bun.sleep

const previousEnv: Record<string, string | undefined> = {}

const envKeys = [
  'ELEVENLABS_API_KEY',
  'SPEECHIFY_API_KEY',
  'HUME_API_KEY',
  'CARTESIA_API_KEY',
  'MISTRAL_API_KEY',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'XAI_API_KEY',
  'MINIMAX_API_KEY',
  'DEEPGRAM_API_KEY'
]

const restoreEnv = (): void => {
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = previousEnv[key]
    }
  }
}

const makeTempDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

beforeEach(() => {
  for (const key of envKeys) {
    previousEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(async () => {
  restoreEnv()
  globalThis.fetch = originalFetch
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('TTS provider service contracts', () => {
  test('Mistral converts non-mp3-wav reference audio to WAV before sending ref_audio', async () => {
      const dir = await makeTempDir('autoshow-mistral-tts-ref-audio-')
      const sourcePath = join(dir, 'reference.m4a')
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

      await Bun.$`ffmpeg -v error -y -i ${LOCAL_SHORT_AUDIO_PATH} -t 1 -c:a aac ${sourcePath}`.quiet()

      process.env['MISTRAL_API_KEY'] = 'mistral-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const request = input instanceof Request ? input : undefined
        const bodyText = typeof init?.body === 'string'
          ? init.body
          : request
            ? await request.clone().text()
            : ''
        const headers = new Headers(init?.headers ?? request?.headers)
        calls.push({
          url: request?.url ?? String(input),
          method: init?.method ?? request?.method ?? 'GET',
          authorization: headers.get('authorization'),
          body: JSON.parse(bodyText) as Record<string, unknown>
        })
        return Response.json({ audio_data: createMockWavBase64() })
      }) as typeof fetch

      const result = await runMistralTts('Mistral reference synthesis.', dir, {
        model: 'voxtral-mini-tts-2603',
        refAudioPath: sourcePath
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toHaveLength(1)
      expect(calls[0]).toMatchObject({
        url: 'https://api.mistral.ai/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer mistral-key'
      })
      expect(calls[0]?.body).toMatchObject({
        model: 'voxtral-mini-tts-2603',
        input: 'Mistral reference synthesis.',
        stream: false,
        response_format: 'wav'
      })

      const refAudio = String(calls[0]?.body['ref_audio'])
      const refBytes = Buffer.from(refAudio, 'base64')
      expect(refBytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(refBytes.subarray(8, 12).toString('ascii')).toBe('WAVE')
      expect(await Bun.file(join(dir, 'mistral-reference-audio.wav')).exists()).toBe(false)
      expect(result.metadata).toMatchObject({
        ttsService: 'mistral',
        ttsModel: 'voxtral-mini-tts-2603',
        speaker: 'ref_audio:reference.m4a',
        chunkCount: 1
      })
    }, 10_000)

  test('Mistral creates a saved voice when reference audio is paired with a voice name', async () => {
      const dir = await makeTempDir('autoshow-mistral-tts-saved-voice-')
      const sourcePath = SHORT_AUDIO_URL
      const mediaBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

      process.env['MISTRAL_API_KEY'] = 'mistral-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const request = input instanceof Request ? input : undefined
        const url = request?.url ?? String(input)
        if (url === SHORT_AUDIO_URL) {
          return new Response(mediaBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        const bodyText = typeof init?.body === 'string'
          ? init.body
          : request
            ? await request.clone().text()
            : ''
        const headers = new Headers(init?.headers ?? request?.headers)
        const method = init?.method ?? request?.method ?? 'GET'
        const body = JSON.parse(bodyText) as Record<string, unknown>
        calls.push({ url, method, authorization: headers.get('authorization'), body })

        if (url.endsWith('/v1/audio/voices')) {
          return Response.json({
            id: 'mistral_saved_voice_123',
            name: 'AutoShow Saved Voice',
            retention_notice: 30,
            created_at: '2026-01-01T00:00:00.000Z',
            user_id: null
          })
        }
        if (url.endsWith('/v1/audio/speech')) {
          return Response.json({ audio_data: createMockWavBase64() })
        }
        throw new Error(`Unexpected Mistral saved voice mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const result = await runMistralTts('Mistral saved voice synthesis.', dir, {
        model: 'voxtral-mini-tts-2603',
        refAudioPath: sourcePath,
        voiceName: 'AutoShow Saved Voice'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toHaveLength(2)
      expect(calls[0]).toMatchObject({
        url: 'https://api.mistral.ai/v1/audio/voices',
        method: 'POST',
        authorization: 'Bearer mistral-key',
        body: {
          name: 'AutoShow Saved Voice',
          sample_filename: '0-audio-short.mp3',
          retention_notice: 30
        }
      })
      expect(typeof calls[0]?.body['sample_audio']).toBe('string')
      expect(String(calls[0]?.body['sample_audio']).length).toBeGreaterThan(0)
      expect(calls[1]).toMatchObject({
        url: 'https://api.mistral.ai/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer mistral-key',
        body: {
          model: 'voxtral-mini-tts-2603',
          input: 'Mistral saved voice synthesis.',
          stream: false,
          response_format: 'wav',
          voice_id: 'mistral_saved_voice_123'
        }
      })
      expect(result.metadata).toMatchObject({
        ttsService: 'mistral',
        ttsModel: 'voxtral-mini-tts-2603',
        speaker: 'mistral_saved_voice_123',
        clonedVoiceId: 'mistral_saved_voice_123',
        cloneCostCents: 0
      })
    }, 10_000)

  test('Mistral multi-speaker TTS sends each speaker reference audio', async () => {
      const dir = await makeTempDir('autoshow-mistral-tts-dialogue-ref-audio-')
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

      process.env['MISTRAL_API_KEY'] = 'mistral-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const request = input instanceof Request ? input : undefined
        const bodyText = typeof init?.body === 'string'
          ? init.body
          : request
            ? await request.clone().text()
            : ''
        const headers = new Headers(init?.headers ?? request?.headers)
        const method = init?.method ?? request?.method ?? 'GET'
        const url = request?.url ?? String(input)
        calls.push({
          url,
          method,
          authorization: headers.get('authorization'),
          body: JSON.parse(bodyText) as Record<string, unknown>
        })
        return Response.json({ audio_data: createMockWavBase64() })
      }) as typeof fetch

      const result = await runTts([
        'Host: Welcome to the reference audio test.',
        'Guest: Thanks. I should use the guest sample.'
      ].join('\n'), dir, {
        mistralTtsModels: ['voxtral-mini-tts-2603'],
        ttsDialogueFormat: 'labeled',
        ttsSpeakerRefAudios: [
          `Host=${LOCAL_SHORT_AUDIO_PATH}`,
          `Guest=${LOCAL_AUDIO_PATH}`
        ]
      } as TtsOptions)

      expect(calls).toHaveLength(2)
      for (const call of calls) {
        expect(call).toMatchObject({
          url: 'https://api.mistral.ai/v1/audio/speech',
          method: 'POST',
          authorization: 'Bearer mistral-key',
          body: {
            model: 'voxtral-mini-tts-2603',
            stream: false,
            response_format: 'wav'
          }
        })
        expect(typeof call.body['ref_audio']).toBe('string')
        expect(String(call.body['ref_audio']).length).toBeGreaterThan(0)
        expect(call.body['voice_id']).toBeUndefined()
      }
      expect(calls[0]?.body['input']).toBe('Welcome to the reference audio test.')
      expect(calls[1]?.body['input']).toBe('Thanks. I should use the guest sample.')

      expect(await Bun.file(join(dir, 'speech.wav')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'dialogue-normalized.txt')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'segments', 'segment-001-Host.wav')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'segments', 'segment-002-Guest.wav')).exists()).toBe(true)
      expect(await Bun.file(result.audioPaths[0] ?? '').exists()).toBe(true)
      expect(result.metadata).toHaveLength(1)
      expect(result.metadata[0]).toMatchObject({
        ttsService: 'mistral',
        ttsModel: 'voxtral-mini-tts-2603',
        speaker: 'Host=ref_audio:0-audio-short.mp3, Guest=ref_audio:1-audio.mp3',
        chunkCount: 2
      })
    }, 10_000)

  test('ElevenLabs TTS sends output format, voice settings, seed, text normalization, and pronunciation dictionaries controls', async () => {
      const dir = await makeTempDir('autoshow-elevenlabs-tts-controls-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

      process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          authorization: new Headers(init?.headers).get('xi-api-key'),
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        })
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      }) as typeof fetch

      const result = await runElevenLabsTts('ElevenLabs control synthesis.', dir, {
        model: 'eleven_v3',
        voiceId: 'voice_existing123',
        controls: {
          outputFormat: 'mp3_22050_32',
          languageCode: 'en',
          voiceSettings: {
            stability: 0.4,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
            speed: 1.1
          },
          seed: 12345,
          textNormalization: 'on',
          pronunciationDictionaryLocators: ['dict_1:version_2', 'dict_3'],
          optimizeStreamingLatency: 2
        }
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toEqual([{
        url: 'https://api.elevenlabs.io/v1/text-to-speech/voice_existing123?output_format=mp3_22050_32&optimize_streaming_latency=2',
        method: 'POST',
        authorization: 'elevenlabs-key',
        body: {
          text: 'ElevenLabs control synthesis.',
          model_id: 'eleven_v3',
          language_code: 'en',
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
            speed: 1.1
          },
          seed: 12345,
          apply_text_normalization: 'on',
          pronunciation_dictionary_locators: [
            {
              pronunciation_dictionary_id: 'dict_1',
              version_id: 'version_2'
            },
            {
              pronunciation_dictionary_id: 'dict_3'
            }
          ]
        }
      }])
      expect(result.metadata.chunkCount).toBe(1)
    }, 10_000)

  test('ElevenLabs sends new model IDs and resolves model-specific character limits', async () => {
    const dir = await makeTempDir('autoshow-elevenlabs-new-models-')
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    const bodies: Array<Record<string, unknown>> = []
    process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'
    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }) as typeof fetch

    for (const model of ['eleven_multilingual_v2', 'eleven_flash_v2_5'] as const) {
      await runElevenLabsTts('New ElevenLabs model.', dir, { model, voiceId: 'voice_existing123' })
    }

    expect(bodies.map((body) => body['model_id'])).toEqual(['eleven_multilingual_v2', 'eleven_flash_v2_5'])
    expect(resolveTtsChunkCharacterLimit('elevenlabs', 'eleven_v3')).toBe(5000)
    expect(resolveTtsChunkCharacterLimit('elevenlabs', 'eleven_multilingual_v2')).toBe(10000)
    expect(resolveTtsChunkCharacterLimit('elevenlabs', 'eleven_flash_v2_5')).toBe(40000)
  }, 10_000)

  test('ElevenLabs TTS splits long text into multiple API calls', async () => {
      const dir = await makeTempDir('autoshow-elevenlabs-tts-chunks-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      const calls: Array<{ url: string, body: Record<string, unknown> }> = []

      process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        calls.push({
          url: String(input),
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        })
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      }) as typeof fetch

      const result = await runElevenLabsTts(`${'A'.repeat(5000)} ${'B'.repeat(100)}`, dir, {
        model: 'eleven_v3',
        voiceId: 'voice_existing123'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        ttsService: 'elevenlabs',
        ttsModel: 'eleven_v3',
        speaker: 'voice_existing123',
        chunkCount: 2
      })
      expect(calls).toHaveLength(2)
      expect(calls.every((call) => call.url === 'https://api.elevenlabs.io/v1/text-to-speech/voice_existing123?output_format=mp3_44100_128')).toBe(true)
      expect(calls.map((call) => String(call.body['text']).length)).toEqual([5000, 100])
    }, 10_000)

  test('ElevenLabs TTS runs chunks concurrently and concatenates in chunk order', async () => {
      const dir = await makeTempDir('autoshow-elevenlabs-tts-chunk-concurrency-')
      const audioByMarker = new Map([
        ['A', createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.2, frequencyHz: 440 })],
        ['B', createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.5, frequencyHz: 440 })],
        ['C', createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.9, frequencyHz: 440 })]
      ])
      const started: string[] = []
      const releases = new Map<string, () => void>()
      let releaseImmediately = false
      let inFlight = 0
      let maxInFlight = 0

      process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'

      globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        const marker = String(body['text'] ?? '').charAt(0)
        started.push(marker)
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        if (!releaseImmediately) {
          await new Promise<void>((resolve) => releases.set(marker, resolve))
        }
        inFlight -= 1
        return new Response(audioByMarker.get(marker) ?? createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.1, frequencyHz: 440 }), {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' }
        })
      }) as typeof fetch

      const runPromise = runElevenLabsTts(`${'A'.repeat(5000)} ${'B'.repeat(5000)} ${'C'.repeat(100)}`, dir, {
        model: 'eleven_v3',
        voiceId: 'voice_existing123',
        chunkConcurrency: 3
      })
      let waitError: unknown

      try {
        await waitForCondition(() => started.length === 3, 'ElevenLabs chunks did not start concurrently')
        expect(started).toEqual(['A', 'B', 'C'])
        expect(maxInFlight).toBe(3)
        for (const marker of ['C', 'B', 'A']) {
          releases.get(marker)?.()
        }
      } catch (error) {
        waitError = error
      } finally {
        releaseImmediately = true
        for (const release of releases.values()) release()
      }

      const result = await runPromise
      if (waitError) throw waitError

      const samples = await readWavSamples(result.audioPath)
      const rmsValues = [0, 1, 2].map((index) => segmentRms(samples, index, 3))
      expect(rmsValues[0] as number).toBeLessThan(rmsValues[1] as number)
      expect(rmsValues[1] as number).toBeLessThan(rmsValues[2] as number)
      expect(result.metadata.chunkCount).toBe(3)
    }, 10_000)

  test('ElevenLabs IVC setup runs once before chunked synthesis', async () => {
      const dir = await makeTempDir('autoshow-elevenlabs-tts-ivc-chunks-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      const calls: Array<{ url: string, method: string, body?: unknown }> = []

      process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        if (url.endsWith('/v1/voices/add')) {
          const form = init?.body as FormData
          calls.push({
            url,
            method,
            body: {
              name: form.get('name'),
              hasFile: form.get('files') instanceof Blob,
              removeBackgroundNoise: form.get('remove_background_noise')
            }
          })
          return Response.json({
            voice_id: 'voice_cloned_once',
            requires_verification: false
          })
        }
        if (url.includes('/v1/text-to-speech/')) {
          calls.push({
            url,
            method,
            body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
          })
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected ElevenLabs IVC chunk mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const result = await runElevenLabsTts(`${'A'.repeat(5000)} ${'B'.repeat(100)}`, dir, {
        model: 'eleven_v3',
        clone: {
          refAudioPath: LOCAL_SHORT_AUDIO_PATH,
          voiceName: 'AutoShow Chunk Clone',
          removeBackgroundNoise: true
        },
        chunkConcurrency: 2
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls.filter((call) => call.url.endsWith('/v1/voices/add'))).toHaveLength(1)
      expect(calls.filter((call) => call.url.includes('/v1/text-to-speech/'))).toHaveLength(2)
      expect(calls.find((call) => call.url.endsWith('/v1/voices/add'))?.body).toEqual({
        name: 'AutoShow Chunk Clone',
        hasFile: true,
        removeBackgroundNoise: 'true'
      })
      expect(calls.filter((call) => call.url.includes('/v1/text-to-speech/')).map((call) => ({
        url: call.url,
        textLength: String((call.body as Record<string, unknown>)['text']).length
      }))).toEqual([
        {
          url: 'https://api.elevenlabs.io/v1/text-to-speech/voice_cloned_once?output_format=mp3_44100_128',
          textLength: 5000
        },
        {
          url: 'https://api.elevenlabs.io/v1/text-to-speech/voice_cloned_once?output_format=mp3_44100_128',
          textLength: 100
        }
      ])
      expect(result.metadata).toMatchObject({
        speaker: 'ref_audio:0-audio-short.mp3',
        clonedVoiceId: 'voice_cloned_once',
        cloneCostCents: 0,
        chunkCount: 2
      })
    }, 10_000)
})
