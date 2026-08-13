import {
  describe,
  expect,
  test
} from 'bun:test'
import { runCartesiaTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/cartesia/run-cartesia-tts'
import { runHumeTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/hume/run-hume-tts'
import { createMockWavBase64 } from '../../../../test-utils/media-fixtures'
import { installMockFetch, LOCAL_SHORT_AUDIO_PATH, setupTtsContractLifecycle } from './shared'

const { makeTempDir } = setupTtsContractLifecycle()

describe('TTS provider service contracts', () => {
  test('Hume TTS posts Octave file requests with chunked utterances and default named voice', async () => {
      const dir = await makeTempDir('autoshow-hume-tts-default-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      process.env['HUME_API_KEY'] = 'hume-key'

      const calls = installMockFetch(() => {
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      })

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
      expect(calls.every((call) => call.headers.get('x-hume-api-key') === 'hume-key')).toBe(true)
      expect(calls.every((call) => call.headers.get('accept') === 'application/octet-stream')).toBe(true)
      expect(calls.map((call) => ((call.bodyJson?.['utterances'] as Array<{ text: string }>)[0] as { text: string }).text.length)).toEqual([2000, 100])
      expect(calls[0]?.bodyJson).toMatchObject({
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
      process.env['HUME_API_KEY'] = 'hume-key'

      const calls = installMockFetch(() => {
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      })

      await runHumeTts('Hume UUID voice synthesis.', idDir, {
        model: 'octave-2',
        voice: '123e4567-e89b-12d3-a456-426614174000'
      })
      await runHumeTts('Hume explicit provider synthesis.', providerDir, {
        model: 'octave-2',
        voice: 'Studio Voice',
        voiceProvider: 'CUSTOM_VOICE'
      })

      expect(((calls[0]?.bodyJson?.['utterances'] as Array<{ voice: unknown }>)[0] as { voice: unknown }).voice).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000'
      })
      expect(((calls[1]?.bodyJson?.['utterances'] as Array<{ voice: unknown }>)[0] as { voice: unknown }).voice).toEqual({
        name: 'Studio Voice',
        provider: 'CUSTOM_VOICE'
      })
    }, 10_000)

  test('Hume Octave 1 selects API version 1 and serializes acting descriptions', async () => {
      const dir = await makeTempDir('autoshow-hume-tts-octave-1-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      process.env['HUME_API_KEY'] = 'hume-key'
      const calls = installMockFetch(() => new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } }))

      await runHumeTts('Directed synthesis.', dir, {
        model: 'octave-1',
        voice: '123e4567-e89b-12d3-a456-426614174000',
        description: 'quiet reassurance'
      })

      expect(calls[0]?.bodyJson).toMatchObject({
        version: '1',
        utterances: [{
          text: 'Directed synthesis.',
          voice: { id: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'quiet reassurance'
        }]
      })
    }, 10_000)

  test('Hume TTS includes non-OK response text in errors', async () => {
      const dir = await makeTempDir('autoshow-hume-tts-error-')
      process.env['HUME_API_KEY'] = 'hume-key'

      installMockFetch(() => {
        return new Response('bad hume', { status: 400 })
      })

      await expect(runHumeTts('Hume error synthesis.', dir, {
        model: 'octave-2'
      })).rejects.toThrow('Hume TTS failed (400): bad hume')
    })

  test('Cartesia TTS posts byte synthesis requests with chunked WAV output', async () => {
      const dir = await makeTempDir('autoshow-cartesia-tts-')
      const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
      process.env['CARTESIA_API_KEY'] = 'cartesia-key'

      const calls = installMockFetch(() => {
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
      })

      const result = await runCartesiaTts(`${'a'.repeat(2000)} ${'b'.repeat(100)}`, dir, {
        model: 'sonic-3.5-2026-05-04',
        voiceId: 'voice-id-123',
        language: 'en'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        ttsService: 'cartesia',
        ttsModel: 'sonic-3.5-2026-05-04',
        speaker: 'voice-id-123',
        chunkCount: 2
      })
      expect(calls).toHaveLength(2)
      expect(calls.every((call) => call.url === 'https://api.cartesia.ai/tts/bytes')).toBe(true)
      expect(calls.every((call) => call.method === 'POST')).toBe(true)
      expect(calls.every((call) => call.headers.get('authorization') === 'Bearer cartesia-key')).toBe(true)
      expect(calls.every((call) => call.headers.get('cartesia-version') === '2026-03-01')).toBe(true)
      expect(calls.every((call) => call.headers.get('accept') === 'application/octet-stream')).toBe(true)
      expect(calls.map((call) => String(call.bodyJson?.['transcript']).length)).toEqual([2000, 100])
      expect(calls[0]?.bodyJson).toMatchObject({
        model_id: 'sonic-3.5-2026-05-04',
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

      installMockFetch(() => {
        return new Response('bad cartesia', { status: 400 })
      })

      await expect(runCartesiaTts('Cartesia error synthesis.', dir, {
        model: 'sonic-3.5-2026-05-04'
      })).rejects.toThrow('Cartesia TTS failed (400): bad cartesia')
    })
})
