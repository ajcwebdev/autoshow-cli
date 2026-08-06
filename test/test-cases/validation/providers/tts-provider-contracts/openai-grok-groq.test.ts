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
import { runGrokTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-grok/run-grok-tts'
import { runGroqTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-groq/run-groq-tts'
import { runOpenAITts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-openai/run-openai-tts'
import { createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { createMockWavBase64, createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { readWavSamples, segmentRms, waitForCondition } from './shared'

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
  test('OpenAI TTS sends instructions and speed in speech requests', async () => {
      const dir = await makeTempDir('autoshow-openai-tts-controls-')
      const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

      process.env['OPENAI_API_KEY'] = 'openai-key'

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
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
      }) as typeof fetch

      const result = await runOpenAITts('OpenAI control synthesis.', dir, {
        model: 'gpt-4o-mini-tts-2025-12-15',
        voiceId: 'alloy',
        instructions: 'Speak with a warm documentary narration style.',
        speed: 1.25
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toHaveLength(1)
      expect(calls[0]).toMatchObject({
        url: 'https://api.openai.com/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer openai-key',
        body: {
          model: 'gpt-4o-mini-tts-2025-12-15',
          voice: 'alloy',
          input: 'OpenAI control synthesis.',
          response_format: 'wav',
          instructions: 'Speak with a warm documentary narration style.',
          speed: 1.25
        }
      })
    }, 10_000)

  test('OpenAI tts-1 drops unsupported instructions from speech requests', async () => {
      const dir = await makeTempDir('autoshow-openai-tts-1-controls-')
      const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

      process.env['OPENAI_API_KEY'] = 'openai-key'

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
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
      }) as typeof fetch

      const result = await runOpenAITts('OpenAI classic synthesis.', dir, {
        model: 'tts-1',
        voiceId: 'alloy',
        instructions: 'Speak with a warm documentary narration style.',
        speed: 1.25
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.body).toMatchObject({
        model: 'tts-1',
        voice: 'alloy',
        input: 'OpenAI classic synthesis.',
        response_format: 'wav',
        speed: 1.25
      })
      expect(calls[0]?.body).not.toHaveProperty('instructions')
    }, 10_000)

  test('Grok TTS sends language, text normalization, and custom voice IDs', async () => {
      const dir = await makeTempDir('autoshow-grok-tts-controls-')
      const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

      process.env['XAI_API_KEY'] = 'xai-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          authorization: new Headers(init?.headers).get('authorization'),
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        })
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
      }) as typeof fetch

      const result = await runGrokTts('Grok control synthesis.', dir, {
        model: 'grok-tts',
        voiceId: 'AB12CD34',
        language: 'ar-SA',
        textNormalization: true
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        ttsService: 'grok',
        ttsModel: 'grok-tts',
        speaker: 'ab12cd34'
      })
      expect(calls).toEqual([{
        url: 'https://api.x.ai/v1/tts',
        method: 'POST',
        authorization: 'Bearer xai-key',
        body: {
          text: 'Grok control synthesis.',
          voice_id: 'ab12cd34',
          language: 'ar-SA',
          text_normalization: true,
          output_format: {
            codec: 'wav',
            sample_rate: 24000
          }
        }
      }])
    }, 10_000)

  test('Grok TTS retries Bun request timeouts and passes per-attempt signals', async () => {
      const dir = await makeTempDir('autoshow-grok-tts-timeout-retry-')
      const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []
      const signals: boolean[] = []
      let attempt = 0

      process.env['XAI_API_KEY'] = 'xai-key'
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        signals.push(init?.signal instanceof AbortSignal)
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          authorization: new Headers(init?.headers).get('authorization'),
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        })
        attempt += 1
        if (attempt === 1) {
          throw new DOMException('The operation timed out.', 'TimeoutError')
        }
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
      }) as typeof fetch

      const result = await runGrokTts('Grok timeout retry synthesis.', dir, {
        model: 'grok-tts'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toHaveLength(2)
      expect(signals).toEqual([true, true])
      expect(calls.map((call) => call.body['text'])).toEqual([
        'Grok timeout retry synthesis.',
        'Grok timeout retry synthesis.'
      ])
    }, 10_000)

  test('Grok TTS runs chunks concurrently and concatenates in chunk order', async () => {
      const dir = await makeTempDir('autoshow-grok-tts-chunk-concurrency-')
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

      process.env['XAI_API_KEY'] = 'xai-key'

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
          headers: { 'content-type': 'audio/wav' }
        })
      }) as typeof fetch

      const input = `${'A'.repeat(2000)} ${'B'.repeat(2000)} ${'C'.repeat(100)}`
      const runPromise = runGrokTts(input, dir, {
        model: 'grok-tts',
        chunkConcurrency: 3
      })
      let waitError: unknown

      try {
        await waitForCondition(() => started.length === 3, 'Grok chunks did not start concurrently')
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

  test('Grok TTS concurrent chunked runs share one hosted provider scheduler', async () => {
      const firstDir = await makeTempDir('autoshow-grok-tts-shared-scheduler-a-')
      const secondDir = await makeTempDir('autoshow-grok-tts-shared-scheduler-b-')
      const scheduler = createHostedTtsChunkScheduler(2)
      const audioBytes = createSyntheticWavBytes({ durationSeconds: 0.2, amplitude: 0.3, frequencyHz: 440 })
      const started: string[] = []
      const releases: Array<() => void> = []
      let releaseImmediately = false
      let inFlight = 0
      let maxInFlight = 0

      process.env['XAI_API_KEY'] = 'xai-key'

      globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        started.push(String(body['text'] ?? '').charAt(0))
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        if (!releaseImmediately) {
          await new Promise<void>((resolve) => releases.push(resolve))
        }
        inFlight -= 1
        return new Response(audioBytes, {
          status: 200,
          headers: { 'content-type': 'audio/wav' }
        })
      }) as typeof fetch

      const firstRun = runGrokTts(`${'A'.repeat(2000)} ${'B'.repeat(2000)} ${'C'.repeat(100)}`, firstDir, {
        model: 'grok-tts',
        chunkConcurrency: 3,
        chunkScheduler: scheduler
      })
      const secondRun = runGrokTts(`${'D'.repeat(2000)} ${'E'.repeat(2000)} ${'F'.repeat(100)}`, secondDir, {
        model: 'grok-tts',
        chunkConcurrency: 3,
        chunkScheduler: scheduler
      })
      let waitError: unknown

      try {
        await waitForCondition(() => started.length === 2, 'Grok shared scheduler did not enforce the provider cap')
        expect(maxInFlight).toBe(2)
        expect(scheduler.getProviderSnapshot('grok')).toMatchObject({
          maxLimit: 2,
          currentLimit: 2,
          active: 2
        })
      } catch (error) {
        waitError = error
      } finally {
        releaseImmediately = true
        for (const release of releases.splice(0)) release()
      }

      const [firstResult, secondResult] = await Promise.all([firstRun, secondRun])
      if (waitError) throw waitError

      expect(await Bun.file(firstResult.audioPath).exists()).toBe(true)
      expect(await Bun.file(secondResult.audioPath).exists()).toBe(true)
      expect(started).toHaveLength(6)
      expect(maxInFlight).toBe(2)
    }, 10_000)

  test('Groq TTS defaults to English Orpheus voice', async () => {
      const dir = await makeTempDir('autoshow-groq-tts-defaults-')
      const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

      process.env['GROQ_API_KEY'] = 'groq-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          authorization: new Headers(init?.headers).get('authorization'),
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        })
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
      }) as typeof fetch

      const result = await runGroqTts('Groq English synthesis.', dir, {
        model: 'canopylabs/orpheus-v1-english'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        ttsService: 'groq',
        ttsModel: 'canopylabs/orpheus-v1-english',
        speaker: 'troy'
      })
      expect(calls).toEqual([{
        url: 'https://api.groq.com/openai/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer groq-key',
        body: {
          model: 'canopylabs/orpheus-v1-english',
          voice: 'troy',
          input: 'Groq English synthesis.',
          response_format: 'wav'
        }
      }])
    }, 10_000)
})
