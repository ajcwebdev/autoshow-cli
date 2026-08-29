import {
  describe,
  expect,
  test
} from 'bun:test'
import { runMinimaxTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-minimax/run-minimax-tts'
import { createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { installMockFetch, LOCAL_SHORT_AUDIO_PATH, setupTtsContractLifecycle } from './shared'

const { makeTempDir } = setupTtsContractLifecycle()
const createScheduler = () => createHostedTtsChunkScheduler({ maxConcurrency: 4, concurrencyMode: 'immediate' })

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
        pronunciations: ['AutoShow/auto show', 'TTS/tee tee ess'],
        chunkScheduler: createScheduler()
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
      model: 'speech-2.8-hd',
      chunkScheduler: createScheduler()
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
      model: 'speech-2.8-hd',
      chunkScheduler: createScheduler()
    })).rejects.toMatchObject({
      stage: 'tts:minimax',
      status: 400,
      headers: expect.any(Headers),
      message: expect.stringContaining('invalid request')
    })
    expect(calls).toHaveLength(1)
  })

})
