import {
  describe,
  expect,
  test
} from 'bun:test'
import { runDeepgramTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepgram/run-deepgram-tts'
import { runMinimaxTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-minimax/run-minimax-tts'
import { LOCAL_SHORT_AUDIO_PATH, setupTtsContractLifecycle } from './shared'

const { makeTempDir } = setupTtsContractLifecycle()

describe('TTS provider service contracts', () => {
  test('MiniMax TTS sends voice controls, language boost, and pronunciation rules', async () => {
      const dir = await makeTempDir('autoshow-minimax-tts-controls-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      const calls: Array<{ url: string, method: string, body?: Record<string, unknown> }> = []

      process.env['MINIMAX_API_KEY'] = 'minimax-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        if (url.endsWith('/v1/t2a_async_v2')) {
          calls.push({
            url,
            method,
            body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
          })
          return Response.json({
            task_id: 'task-1',
            base_resp: { status_code: 0, status_msg: 'success' }
          })
        }
        if (url.includes('/v1/query/t2a_async_query_v2')) {
          calls.push({ url, method })
          return Response.json({
            status: 2,
            file_id: 'speech-file-id',
            base_resp: { status_code: 0, status_msg: 'success' }
          })
        }
        if (url.includes('/v1/files/retrieve_content')) {
          calls.push({ url, method })
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected MiniMax mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const result = await runMinimaxTts('MiniMax control synthesis.', dir, {
        model: 'speech-2.8-hd',
        voiceId: 'English_expressive_narrator',
        languageBoost: 'English',
        speed: 1.2,
        volume: 2.5,
        pitch: -2,
        emotion: 'calm',
        englishNormalization: true,
        pronunciations: ['AutoShow/auto show', 'TTS/tee tee ess']
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls[0]).toEqual({
        url: 'https://api.minimax.io/v1/t2a_async_v2',
        method: 'POST',
        body: {
          model: 'speech-2.8-hd',
          text: 'MiniMax control synthesis.',
          voice_setting: {
            voice_id: 'English_expressive_narrator',
            speed: 1.2,
            vol: 2.5,
            pitch: -2,
            emotion: 'calm',
            english_normalization: true
          },
          audio_setting: {
            format: 'mp3',
            audio_sample_rate: 32000,
            channel: 1
          },
          language_boost: 'English',
          pronunciation_dict: {
            tone: ['AutoShow/auto show', 'TTS/tee tee ess']
          }
        }
      })
      expect(calls.map((call) => call.method)).toEqual(['POST', 'GET', 'GET'])
    }, 10_000)

  test('Deepgram TTS sends documented output controls as query parameters', async () => {
      const dir = await makeTempDir('autoshow-deepgram-tts-controls-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

      process.env['DEEPGRAM_API_KEY'] = 'deepgram-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          authorization: new Headers(init?.headers).get('authorization'),
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        })
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      }) as typeof fetch

      const result = await runDeepgramTts('Deepgram control synthesis.', dir, {
        model: 'aura-2-thalia-en',
        voiceId: 'aura-2-andromeda-en',
        encoding: 'linear16',
        container: 'wav',
        bitRate: 128000,
        sampleRate: 24000,
        speed: 1.1
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toEqual([{
        url: 'https://api.deepgram.com/v1/speak?model=aura-2-andromeda-en&encoding=linear16&container=wav&bit_rate=128000&sample_rate=24000&speed=1.1',
        method: 'POST',
        authorization: 'Token deepgram-key',
        body: { text: 'Deepgram control synthesis.' }
      }])
    }, 10_000)

  test('Deepgram TTS sends each newly registered model through the existing query transport', async () => {
    const dir = await makeTempDir('autoshow-deepgram-new-models-')
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    const urls: string[] = []
    process.env['DEEPGRAM_API_KEY'] = 'deepgram-key'
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
      urls.push(String(input))
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }) as typeof fetch

    for (const model of ['aura-2-helena-en', 'aura-2-arcas-en', 'aura-2-aries-en'] as const) {
      await runDeepgramTts('New Deepgram model.', dir, { model })
    }

    expect(urls).toEqual([
      'https://api.deepgram.com/v1/speak?model=aura-2-helena-en',
      'https://api.deepgram.com/v1/speak?model=aura-2-arcas-en',
      'https://api.deepgram.com/v1/speak?model=aura-2-aries-en'
    ])
  }, 10_000)
})
