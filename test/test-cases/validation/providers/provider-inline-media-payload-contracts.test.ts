import { describe, expect, test } from 'bun:test'
import * as v from 'valibot'
import { runInworldTts } from '~/cli/commands/audio/tts/tts-services/inworld/run-inworld-tts'
import { createHostedTtsChunkScheduler } from '~/cli/commands/audio/tts/tts-utils/hosted-tts-chunk-scheduler'
import { assertInlineSpeechResponsesFit } from '~/cli/commands/audio/tts/tts-utils/hosted-tts-chunk-pipeline'
import { INWORLD_TTS_AUDIO_BYTES_PER_SECOND } from '~/cli/commands/audio/tts/tts-services/inworld/inworld-tts-request'
import { AppError } from '~/utils/error-handler'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { HTTP_PAYLOAD_MAX_BYTES_ENV } from '~/utils/http-payload'
import { MinimaxBaseRespSchema, minimaxFetchJson, minimaxJsonRequestInit } from '~/utils/minimax-client/minimax-client'
import { mistralJsonRequest } from '~/utils/mistral/mistral-client'
import { openAIJsonRequest } from '~/utils/openai/openai-client'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

// Every case here is mocked transport. They establish that a large inlined body is read and decoded
// intact, not that any provider's speech is correct or sounds right.

const tempDirs = setupContractSuiteLifecycle({
  envKeys: [HTTP_PAYLOAD_MAX_BYTES_ENV, 'INWORLD_API_KEY'],
  tempPrefix: 'autoshow-inline-media-payload-'
})

const MIB = 1024 * 1024
const FORMER_SHARED_CAPTURE_BYTES = 16 * MIB
// Decodes to more than 16 MiB, so the base64 or hex JSON around it is larger still.
const LARGE_MEDIA = Buffer.alloc(FORMER_SHARED_CAPTURE_BYTES + MIB, 7)
const LARGE_MEDIA_BASE64 = LARGE_MEDIA.toString('base64')

const largeJsonResponse = (body: unknown): Response => {
  const text = JSON.stringify(body)
  expect(Buffer.byteLength(text)).toBeGreaterThan(FORMER_SHARED_CAPTURE_BYTES)
  return new Response(text, { status: 200, headers: { 'content-type': 'application/json' } })
}

const readWavDurationSeconds = async (path: string): Promise<number> => {
  const buffer = Buffer.from(await Bun.file(path).arrayBuffer())
  const byteRate = buffer.readUInt32LE(28)
  let offset = 12
  while (offset + 8 <= buffer.byteLength) {
    const chunkSize = buffer.readUInt32LE(offset + 4)
    if (buffer.toString('ascii', offset, offset + 4) === 'data') return Math.min(chunkSize, buffer.byteLength - offset - 8) / byteRate
    offset += 8 + chunkSize + (chunkSize % 2)
  }
  throw new Error(`No data chunk found in WAV file: ${path}`)
}

// 48 kHz 16-bit mono, the format the Inworld request asks for.
const INWORLD_SAMPLE_RATE = 48000
const LARGE_WAV_SAMPLES = 9_500_000
const largeInworldWav = (): string => createMockWavBytes({ samples: LARGE_WAV_SAMPLES, sampleRate: INWORLD_SAMPLE_RATE }).toString('base64')

const runInworld = async (text: string, root: string) => await runInworldTts(text, root, {
  model: 'realtime-tts-2',
  apiKey: 'local-test-key',
  voiceId: 'Dennis',
  chunkScheduler: createHostedTtsChunkScheduler({ maxConcurrency: 1 })
})

describe('inline media payload contracts (mocked transport, decoded artifact integrity only)', () => {
  test('Inworld decodes a chunk whose base64 WAV response exceeds the former 16 MiB capture into an intact artifact', async () => {
    const root = await tempDirs.make()
    const calls = installMockFetch(() => largeJsonResponse({ audioContent: largeInworldWav(), timestampInfo: { wordAlignment: { words: [], wordStartTimeSeconds: [], wordEndTimeSeconds: [] } } }))

    const result = await runInworld('A long narrated passage.', root)

    expect(calls).toHaveLength(1)
    expect(await readWavDurationSeconds(result.audioPath)).toBeCloseTo(LARGE_WAV_SAMPLES / INWORLD_SAMPLE_RATE, 0)
  }, 60_000)

  test('Inworld rejects a large response whose audio field is missing instead of writing an artifact', async () => {
    const root = await tempDirs.make()
    installMockFetch(() => largeJsonResponse({ padding: LARGE_MEDIA_BASE64 }))

    await expect(runInworld('A long narrated passage.', root)).rejects.toThrow('Inworld AI TTS response missing audioContent')
  }, 60_000)

  test('Inworld rejects a full-size chunk before dispatch when the override cannot hold its response, then dispatches again after reset', async () => {
    const root = await tempDirs.make()
    const calls = installMockFetch(() => Response.json({ audioContent: createMockWavBytes({ samples: 4800, sampleRate: INWORLD_SAMPLE_RATE }).toString('base64') }))
    const fullChunk = 'word '.repeat(400).trim()

    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = String(FORMER_SHARED_CAPTURE_BYTES)
    let thrown: unknown
    try {
      await runInworld(fullChunk, root)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(AppError)
    expect((thrown as AppError).message).toContain('Inworld AI TTS chunk 1 of 1: response body is estimated at')
    expect((thrown as AppError).message).toContain(HTTP_PAYLOAD_MAX_BYTES_ENV)
    expect((thrown as AppError).stage).toBe('tts:inworld')
    expect(calls).toHaveLength(0)

    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = String(64 * MIB)
    await runInworld(fullChunk, await tempDirs.make())
    expect(calls).toHaveLength(1)

    delete process.env[HTTP_PAYLOAD_MAX_BYTES_ENV]
    await runInworld(fullChunk, await tempDirs.make())
    expect(calls).toHaveLength(2)
  }, 60_000)

  test('the pre-dispatch estimate is an upper bound for a full Inworld chunk and scales with slower speech', () => {
    const fullChunk = 'x'.repeat(2000)
    const response = { audioBytesPerSecond: INWORLD_TTS_AUDIO_BYTES_PER_SECOND, encoding: 'base64' } as const
    expect(INWORLD_TTS_AUDIO_BYTES_PER_SECOND).toBe(96_000)
    expect(() => assertInlineSpeechResponsesFit('Inworld AI', 'tts:inworld', [fullChunk], response)).not.toThrow()

    // 2000 characters at 8 per second is 250 s: 24 MB of audio, 32 MB as base64, plus the timing envelope.
    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = String(32_128_000)
    expect(() => assertInlineSpeechResponsesFit('Inworld AI', 'tts:inworld', [fullChunk], response)).not.toThrow()
    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = String(32_127_999)
    expect(() => assertInlineSpeechResponsesFit('Inworld AI', 'tts:inworld', [fullChunk], response)).toThrow('chunk 1 of 1')

    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = String(40 * MIB)
    expect(() => assertInlineSpeechResponsesFit('Inworld AI', 'tts:inworld', ['short', fullChunk], { ...response, speed: 0.5 })).toThrow('chunk 2 of 2')
  })

  test('the Mistral client returns base64 audio larger than the former 16 MiB capture byte for byte', async () => {
    installMockFetch(() => largeJsonResponse({ audio_data: LARGE_MEDIA_BASE64 }))
    const response = await mistralJsonRequest<{ audio_data: string }>({
      apiKey: 'mistral-key',
      baseURL: 'https://mock.mistral.local',
      path: '/audio/speech',
      errorMessagePrefix: 'Mistral TTS failed',
      body: { input: 'hello' }
    })
    expect(Buffer.from(response.audio_data, 'base64').equals(LARGE_MEDIA)).toBe(true)
  })

  test('the Gemini client returns inline data larger than the former 16 MiB capture byte for byte', async () => {
    installMockFetch(() => largeJsonResponse({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16', data: LARGE_MEDIA_BASE64 } }] } }] }))
    const response = await geminiGenerateContent('gemini-key', { model: 'gemini-test', contents: 'hello' }) as unknown as { candidates: Array<{ content: { parts: Array<{ inlineData: { data: string } }> } }> }
    expect(Buffer.from(response.candidates[0]?.content.parts[0]?.inlineData.data ?? '', 'base64').equals(LARGE_MEDIA)).toBe(true)
  })

  test('the OpenAI-compatible client returns a b64_json image larger than the former 16 MiB capture byte for byte', async () => {
    installMockFetch(() => largeJsonResponse({ data: [{ b64_json: LARGE_MEDIA_BASE64 }] }))
    const response = await openAIJsonRequest<{ data: Array<{ b64_json: string }> }>(
      { apiKey: 'openai-key', baseURL: 'https://mock.openai.local' },
      '/images/generations',
      { model: 'image-test', prompt: 'hello' }
    )
    expect(Buffer.from(response.data[0]?.b64_json ?? '', 'base64').equals(LARGE_MEDIA)).toBe(true)
  })

  test('the MiniMax client returns hex audio larger than the former 16 MiB capture without a per-call override', async () => {
    installMockFetch(() => largeJsonResponse({ data: { audio: LARGE_MEDIA.toString('hex') }, base_resp: { status_code: 0, status_msg: 'success' } }))
    const response = await minimaxFetchJson('https://mock.minimax.local/v1/music_generation', {
      init: minimaxJsonRequestInit('minimax-key', 'POST', { prompt: 'hello' }),
      schema: v.object({ data: v.object({ audio: v.string() }), base_resp: v.optional(MinimaxBaseRespSchema, undefined) }),
      responseContext: 'MiniMax music generation response',
      baseRespContext: 'MiniMax music generation',
      stage: 'music:minimax',
      httpErrorMessage: 'MiniMax music generation failed'
    })
    expect(Buffer.from(response.data.audio, 'hex').equals(LARGE_MEDIA)).toBe(true)
  })

  test('a shared client still rejects a body over the active ceiling whole, naming the override', async () => {
    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = String(MIB)
    installMockFetch(() => largeJsonResponse({ audio_data: LARGE_MEDIA_BASE64 }))
    let thrown: unknown
    try {
      await mistralJsonRequest({ apiKey: 'mistral-key', baseURL: 'https://mock.mistral.local', path: '/audio/speech', errorMessagePrefix: 'Mistral TTS failed', body: { input: 'hello' } })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(AppError)
    expect((thrown as AppError).retryable).toBe(false)
    expect((thrown as AppError).message).toContain(`over the 1,048,576 byte ceiling for result HTTP payloads. Set ${HTTP_PAYLOAD_MAX_BYTES_ENV}`)
  })
})
