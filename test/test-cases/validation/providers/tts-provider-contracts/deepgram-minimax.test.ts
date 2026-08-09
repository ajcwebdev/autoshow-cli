import {
  describe,
  expect,
  test
} from 'bun:test'
import { runDeepgramTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepgram/run-deepgram-tts'
import { runMinimaxTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-minimax/run-minimax-tts'
import { installMockFetch, LOCAL_SHORT_AUDIO_PATH, setupTtsContractLifecycle } from './shared'

const { makeTempDir } = setupTtsContractLifecycle()

describe('TTS provider service contracts', () => {
  test('MiniMax TTS sends voice controls, language boost, and pronunciation rules', async () => {
      const dir = await makeTempDir('autoshow-minimax-tts-controls-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      process.env['MINIMAX_API_KEY'] = 'minimax-key'

      const calls = installMockFetch((call) => {
        if (call.url.endsWith('/v1/t2a_async_v2')) {
          return Response.json({
            task_id: 'task-1',
            base_resp: { status_code: 0, status_msg: 'success' }
          })
        }
        if (call.url.includes('/v1/query/t2a_async_query_v2')) {
          return Response.json({
            status: 2,
            file_id: 'speech-file-id',
            base_resp: { status_code: 0, status_msg: 'success' }
          })
        }
        if (call.url.includes('/v1/files/retrieve_content')) {
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected MiniMax mock fetch: ${call.method} ${call.url}`)
      })

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
      expect(calls[0]).toMatchObject({
        url: 'https://api.minimax.io/v1/t2a_async_v2',
        method: 'POST',
        bodyJson: {
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

  test('MiniMax TTS protocol failures keep the TTS stage', async () => {
    const dir = await makeTempDir('autoshow-minimax-tts-stage-')
    process.env['MINIMAX_API_KEY'] = 'minimax-key'
    installMockFetch(() => Response.json({
      task_id: 'task-failed',
      base_resp: { status_code: 1004, status_msg: 'invalid text' }
    }))

    await expect(runMinimaxTts('Invalid MiniMax request.', dir, {
      model: 'speech-2.8-hd'
    })).rejects.toMatchObject({
      stage: 'tts:minimax',
      message: expect.stringContaining('invalid text')
    })
  })

  test('MiniMax TTS HTTP failures retain retry-classification response metadata', async () => {
    const dir = await makeTempDir('autoshow-minimax-tts-http-error-')
    process.env['MINIMAX_API_KEY'] = 'minimax-key'
    const calls = installMockFetch(() => new Response('invalid request', {
      status: 400,
      headers: { 'retry-after': '3' }
    }))

    await expect(runMinimaxTts('Invalid MiniMax request.', dir, {
      model: 'speech-2.8-hd'
    })).rejects.toMatchObject({
      stage: 'tts:minimax',
      status: 400,
      headers: expect.any(Headers),
      message: expect.stringContaining('invalid request')
    })
    expect(calls).toHaveLength(1)
  })

  test('Deepgram TTS sends documented output controls as query parameters', async () => {
      const dir = await makeTempDir('autoshow-deepgram-tts-controls-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      process.env['DEEPGRAM_API_KEY'] = 'deepgram-key'

      const calls = installMockFetch(() => {
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      })

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
      expect(calls).toHaveLength(1)
      expect(calls[0]).toMatchObject({
        url: 'https://api.deepgram.com/v1/speak?model=aura-2-andromeda-en&encoding=linear16&container=wav&bit_rate=128000&sample_rate=24000&speed=1.1',
        method: 'POST',
        bodyJson: { text: 'Deepgram control synthesis.' }
      })
      expect(calls[0]?.headers.get('authorization')).toBe('Token deepgram-key')
    }, 10_000)

  test('Deepgram TTS sends each newly registered model through the existing query transport', async () => {
    const dir = await makeTempDir('autoshow-deepgram-new-models-')
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    process.env['DEEPGRAM_API_KEY'] = 'deepgram-key'
    const calls = installMockFetch(() => {
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    })

    for (const model of ['aura-2-helena-en', 'aura-2-arcas-en', 'aura-2-aries-en'] as const) {
      await runDeepgramTts('New Deepgram model.', dir, { model })
    }

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.deepgram.com/v1/speak?model=aura-2-helena-en',
      'https://api.deepgram.com/v1/speak?model=aura-2-arcas-en',
      'https://api.deepgram.com/v1/speak?model=aura-2-aries-en'
    ])
  }, 10_000)
})
