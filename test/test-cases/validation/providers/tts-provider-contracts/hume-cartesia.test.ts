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
import { runCartesiaTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/cartesia/run-cartesia-tts'
import { runHumeTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/hume/run-hume-tts'
import { createMockWavBase64 } from '../../../../test-utils/media-fixtures'
import { LOCAL_SHORT_AUDIO_PATH } from './shared'

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
  test('Hume TTS posts Octave file requests with chunked utterances and default named voice', async () => {
      const dir = await makeTempDir('autoshow-hume-tts-default-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      const calls: Array<{
        url: string
        method: string
        apiKey: string | null
        accept: string | null
        body: Record<string, unknown>
      }> = []

      process.env['HUME_API_KEY'] = 'hume-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const headers = new Headers(init?.headers)
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          apiKey: headers.get('x-hume-api-key'),
          accept: headers.get('accept'),
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        })
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      }) as typeof fetch

      const result = await runHumeTts(`${'a'.repeat(2000)} ${'b'.repeat(100)}`, dir, {
        model: 'octave-2'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        ttsService: 'hume',
        ttsModel: 'octave-2',
        speaker: 'Male English Actor',
        chunkCount: 2
      })
      expect(calls).toHaveLength(2)
      expect(calls.every((call) => call.url === 'https://api.hume.ai/v0/tts/file')).toBe(true)
      expect(calls.every((call) => call.method === 'POST')).toBe(true)
      expect(calls.every((call) => call.apiKey === 'hume-key')).toBe(true)
      expect(calls.every((call) => call.accept === 'application/octet-stream')).toBe(true)
      expect(calls.map((call) => ((call.body['utterances'] as Array<{ text: string }>)[0] as { text: string }).text.length)).toEqual([2000, 100])
      expect(calls[0]?.body).toMatchObject({
        version: '2',
        format: { type: 'mp3' },
        num_generations: 1,
        utterances: [{
          text: 'a'.repeat(2000),
          voice: {
            name: 'Male English Actor',
            provider: 'HUME_AI'
          }
        }]
      })
    }, 10_000)

  test('Hume TTS sends UUID voice IDs unless a provider is explicit', async () => {
      const idDir = await makeTempDir('autoshow-hume-tts-id-')
      const providerDir = await makeTempDir('autoshow-hume-tts-provider-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      const bodies: Record<string, unknown>[] = []

      process.env['HUME_API_KEY'] = 'hume-key'

      globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        bodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      }) as typeof fetch

      await runHumeTts('Hume UUID voice synthesis.', idDir, {
        model: 'octave-2',
        voice: '123e4567-e89b-12d3-a456-426614174000'
      })
      await runHumeTts('Hume explicit provider synthesis.', providerDir, {
        model: 'octave-2',
        voice: 'Studio Voice',
        voiceProvider: 'CUSTOM_VOICE'
      })

      expect(((bodies[0]?.['utterances'] as Array<{ voice: unknown }>)[0] as { voice: unknown }).voice).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000'
      })
      expect(((bodies[1]?.['utterances'] as Array<{ voice: unknown }>)[0] as { voice: unknown }).voice).toEqual({
        name: 'Studio Voice',
        provider: 'CUSTOM_VOICE'
      })
    }, 10_000)

  test('Hume TTS includes non-OK response text in errors', async () => {
      const dir = await makeTempDir('autoshow-hume-tts-error-')
      process.env['HUME_API_KEY'] = 'hume-key'

      globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        return new Response('bad hume', { status: 400 })
      }) as typeof fetch

      await expect(runHumeTts('Hume error synthesis.', dir, {
        model: 'octave-2'
      })).rejects.toThrow('Hume TTS failed (400): bad hume')
    })

  test('Cartesia TTS posts byte synthesis requests with chunked WAV output', async () => {
      const dir = await makeTempDir('autoshow-cartesia-tts-')
      const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
      const calls: Array<{
        url: string
        method: string
        authorization: string | null
        version: string | null
        accept: string | null
        body: Record<string, unknown>
      }> = []

      process.env['CARTESIA_API_KEY'] = 'cartesia-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const headers = new Headers(init?.headers)
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          authorization: headers.get('authorization'),
          version: headers.get('cartesia-version'),
          accept: headers.get('accept'),
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        })
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
      }) as typeof fetch

      const result = await runCartesiaTts(`${'a'.repeat(2000)} ${'b'.repeat(100)}`, dir, {
        model: 'sonic-3.5',
        voiceId: 'voice-id-123',
        language: 'en'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        ttsService: 'cartesia',
        ttsModel: 'sonic-3.5',
        speaker: 'voice-id-123',
        chunkCount: 2
      })
      expect(calls).toHaveLength(2)
      expect(calls.every((call) => call.url === 'https://api.cartesia.ai/tts/bytes')).toBe(true)
      expect(calls.every((call) => call.method === 'POST')).toBe(true)
      expect(calls.every((call) => call.authorization === 'Bearer cartesia-key')).toBe(true)
      expect(calls.every((call) => call.version === '2026-03-01')).toBe(true)
      expect(calls.every((call) => call.accept === 'application/octet-stream')).toBe(true)
      expect(calls.map((call) => String(call.body['transcript']).length)).toEqual([2000, 100])
      expect(calls[0]?.body).toMatchObject({
        model_id: 'sonic-3.5',
        transcript: 'a'.repeat(2000),
        voice: {
          mode: 'id',
          id: 'voice-id-123'
        },
        language: 'en',
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: 24000
        }
      })
    }, 10_000)

  test('Cartesia TTS includes non-OK response text in errors', async () => {
      const dir = await makeTempDir('autoshow-cartesia-tts-error-')
      process.env['CARTESIA_API_KEY'] = 'cartesia-key'

      globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        return new Response('bad cartesia', { status: 400 })
      }) as typeof fetch

      await expect(runCartesiaTts('Cartesia error synthesis.', dir, {
        model: 'sonic-3'
      })).rejects.toThrow('Cartesia TTS failed (400): bad cartesia')
    })
})
