import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { runElevenLabsMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/music-elevenlabs/run-elevenlabs-music-gen'
import { writeGeminiMusicInlineAudio } from '~/cli/commands/process-steps/step-7-music/music-services/music-gemini/run-gemini-music-gen'
import { runMinimaxMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/music-minimax/run-minimax-music-gen'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { expectProviderHttpError, restoreEnv, snapshotEnv } from '../../../test-utils/rest-contract-helpers'

const audioBytes = new Uint8Array([1, 2, 3, 4])
const audioHex = Buffer.from(audioBytes).toString('hex')
const audioBase64 = Buffer.from(audioBytes).toString('base64')

const withEnvAndFetch = async <T,>(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  fn: () => Promise<T>
): Promise<T> => {
  const previousFetch = globalThis.fetch
  const previousEnv = snapshotEnv(Object.keys(env))

  try {
    restoreEnv(env)
    globalThis.fetch = fetchImpl
    return await fn()
  } finally {
    globalThis.fetch = previousFetch
    restoreEnv(previousEnv)
  }
}

const readJsonBody = (body: RequestInit['body'] | null | undefined): Record<string, unknown> =>
  JSON.parse(String(body ?? '{}')) as Record<string, unknown>

describe('music provider contracts', () => {
  test('MiniMax music accepts 3.0 and rejects previous-generation and unsupported models', () => {
    const opts = buildOptsFromFlags(false, {
      'minimax-music': ['music-3.0']
    })

    expect(opts.minimaxMusicModels).toEqual(['music-3.0'])
    expect(collectMusicTargets(opts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'minimax:music-3.0'
    ])
    const previousModel = 'music-2' + '.6'
    expect(() => buildOptsFromFlags(false, {
      'minimax-music': previousModel
    })).toThrow(`Invalid model "${previousModel}" for --provider/--music minimax[=model]`)
    expect(() => buildOptsFromFlags(false, {
      'minimax-music': 'music-cover'
    })).toThrow('Invalid model "music-cover" for --provider/--music minimax[=model]')
  })

  test('MiniMax instrumental flow sends is_instrumental and skips lyrics generation', async () => {
    const calls: Array<Record<string, unknown>> = []

    await withTempDir('autoshow-music-provider-', async (dir) => {
      await withEnvAndFetch({
        MINIMAX_API_KEY: 'test-key'
      }, (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/v1/lyrics_generation')) {
          throw new Error('MiniMax lyrics generation should not be called for instrumental runs')
        }
        if (url.endsWith('/v1/music_generation')) {
          const body = readJsonBody(init?.body)
          calls.push(body)
          return new Response(JSON.stringify({
            data: { audio: audioHex, status: 2 },
            trace_id: 'trace-instrumental',
            extra_info: {
              music_duration: 32100,
              music_sample_rate: 44100,
              music_channel: 2,
              bitrate: 256000,
              music_size: audioBytes.byteLength
            },
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected MiniMax mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch, async () => {
        const opts = buildOptsFromFlags(false, {
          'minimax-music': 'music-3.0',
          'music-instrumental': true
        })
        const [target] = collectMusicTargets(opts)
        expect(target).toBeDefined()
        const result = await target!.run('ambient piano instrumental', dir)

        expect(await Bun.file(result.musicPath).exists()).toBe(true)
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({
          model: 'music-3.0',
          prompt: 'ambient piano instrumental',
          is_instrumental: true,
          output_format: 'hex',
          audio_setting: {
            sample_rate: 44100,
            bitrate: 256000,
            format: 'mp3'
          }
        })
        expect('lyrics' in calls[0]!).toBe(false)
        expect(result.metadata).toMatchObject({
          musicService: 'minimax',
          musicModel: 'music-3.0',
          lyricsSource: 'none',
          musicDurationMs: 32100,
          providerTraceId: 'trace-instrumental',
          audioSampleRate: 44100,
          audioChannelCount: 2,
          audioBitrate: 256000,
          providerAudioByteSize: audioBytes.byteLength,
          outputFormat: 'mp3'
        })
      })
    })
  })

  test('MiniMax music protocol failures keep the music stage', async () => {
    await withTempDir('autoshow-music-provider-', async (dir) => {
      await withEnvAndFetch({
        MINIMAX_API_KEY: 'test-key'
      }, (async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]): Promise<Response> => new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })) as typeof fetch, async () => {
        await expectProviderHttpError(
          () => runMinimaxMusicGen('ambient instrumental', dir, {
            model: 'music-3.0',
            forceInstrumental: true
          }),
          { stage: 'music:minimax', messageContains: 'returned invalid JSON' }
        )
      })
    })
  })

  test('MiniMax auto-lyrics metadata captures generated title, style, and lyrics', async () => {
    const calls: Array<{ url: string, body: Record<string, unknown> }> = []

    await withTempDir('autoshow-music-provider-', async (dir) => {
      await withEnvAndFetch({
        MINIMAX_API_KEY: 'test-key'
      }, (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const body = readJsonBody(init?.body)
        calls.push({ url, body })
        if (url.endsWith('/v1/lyrics_generation')) {
          return new Response(JSON.stringify({
            song_title: 'Neon Rain',
            style_tags: 'synth pop, nocturnal',
            lyrics: '[Verse]\nNeon rain on the avenue',
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.endsWith('/v1/music_generation')) {
          return new Response(JSON.stringify({
            data: { audio: audioHex, status: 2 },
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected MiniMax mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch, async () => {
        const result = await runMinimaxMusicGen('synth pop about neon rain', dir, {
          model: 'music-3.0'
        })

        expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
          '/v1/lyrics_generation',
          '/v1/music_generation'
        ])
        expect(calls[1]?.body).toMatchObject({
          model: 'music-3.0',
          lyrics: '[Verse]\nNeon rain on the avenue'
        })
        expect(result.metadata).toMatchObject({
          lyricsSource: 'generated',
          generatedSongTitle: 'Neon Rain',
          generatedStyleTags: 'synth pop, nocturnal',
          generatedLyrics: '[Verse]\nNeon rain on the avenue'
        })
      })
    })
  })

  test('MiniMax caps prompt length and validates lyrics length before generation requests', async () => {
    const calls: Array<Record<string, unknown>> = []

    await withTempDir('autoshow-music-provider-', async (dir) => {
      await withEnvAndFetch({
        MINIMAX_API_KEY: 'test-key'
      }, (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/v1/music_generation')) {
          calls.push(readJsonBody(init?.body))
          return new Response(JSON.stringify({
            data: { audio: audioHex, status: 2 },
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected MiniMax mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch, async () => {
        const longPrompt = 'x'.repeat(2001)
        await runMinimaxMusicGen(longPrompt, dir, {
          model: 'music-3.0',
          forceInstrumental: true
        })

        expect(calls).toHaveLength(1)
        expect(calls[0]?.['prompt']).toBe('x'.repeat(2000))

        const lyricsPath = join(dir, 'lyrics.txt')
        await writeFile(lyricsPath, 'y'.repeat(3501))
        const callCountBeforeLyricsValidation = calls.length
        await expect(runMinimaxMusicGen('valid prompt', dir, {
          model: 'music-3.0',
          lyricsFile: lyricsPath
        })).rejects.toThrow('must be 3500 characters or fewer')

        expect(calls).toHaveLength(callCountBeforeLyricsValidation)
      })
    })
  })

  test('Gemini text parts are preserved while audio inline data is written', async () => {
    await withTempDir('autoshow-music-provider-', async (dir) => {
      const musicPath = join(dir, 'generated-music.mp3')
      const result = await writeGeminiMusicInlineAudio([
        { thought: true, text: 'hidden scratchpad' },
        { text: '[Verse]\nSilver static in the sky' },
        { inlineData: { data: Buffer.alloc(0).toString('base64'), mimeType: 'audio/mpeg' } },
        { inlineData: { data: audioBase64, mimeType: 'audio/mpeg' } }
      ], musicPath)

      expect(new Uint8Array(await Bun.file(musicPath).arrayBuffer())).toEqual(audioBytes)
      expect(result).toEqual({
        audioMimeType: 'audio/mpeg',
        outputFormat: 'mp3',
        generatedText: '[Verse]\nSilver static in the sky'
      })
    })
  })

  test('ElevenLabs music uses the v2 output format and records response headers', async () => {
    const requests: Array<{ url: string, body: Record<string, unknown> }> = []

    await withTempDir('autoshow-music-provider-', async (dir) => {
      await withEnvAndFetch({
        ELEVENLABS_API_KEY: 'test-key'
      }, (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/music?output_format=mp3_48000_192')) {
          requests.push({ url, body: readJsonBody(init?.body) })
          return new Response(audioBytes, {
            status: 200,
            headers: {
              'content-type': 'audio/mpeg',
              'request-id': 'eleven-request-123'
            }
          })
        }
        throw new Error(`Unexpected ElevenLabs mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch, async () => {
        const v2Result = await runElevenLabsMusicGen('cinematic instrumental', dir, {
          model: 'music_v2',
          durationSeconds: 15,
          forceInstrumental: true
        })

        expect(requests).toEqual([
          {
            url: 'https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192',
            body: {
              model_id: 'music_v2',
              prompt: 'cinematic instrumental',
              music_length_ms: 15000,
              force_instrumental: true
            }
          }
        ])
        expect(v2Result.metadata).toMatchObject({
          providerRequestId: 'eleven-request-123',
          audioMimeType: 'audio/mpeg',
          audioSampleRate: 48000,
          audioBitrate: 192000,
          providerAudioByteSize: audioBytes.byteLength,
          outputFormat: 'mp3_48000_192'
        })
      })
    })
  })
})
