import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runElevenLabsTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/run-elevenlabs-tts'
import { createElevenLabsTtsIvcContext } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-ivc'
import { LOCAL_SHORT_AUDIO_PATH } from './shared'

describe('ElevenLabs clone flow contracts', () => {
  test('elevenlabs clone flow creates once and reuses cloned voice across runs', async () => {
      const previousKey = process.env['ELEVENLABS_API_KEY']
      const previousFetch = globalThis.fetch
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-clone-flow-'))
      const calls: Array<{ url: string, method: string, body?: unknown }> = []

      try {
        process.env['ELEVENLABS_API_KEY'] = 'test-key'
        const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()

        globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
          const url = String(input)
          const method = init?.method ?? 'GET'
          const body = init?.body

          if (url.endsWith('/v1/voices/add') && body instanceof FormData) {
            calls.push({
              url,
              method,
              body: {
                name: body.get('name'),
                hasFile: body.get('files') instanceof Blob,
                removeBackgroundNoise: body.get('remove_background_noise')
              }
            })
            return new Response(JSON.stringify({
              voice_id: 'voice_elevenlabs_mock',
              requires_verification: false
            }), { status: 200, headers: { 'content-type': 'application/json' } })
          }
          if (url.includes('/v1/text-to-speech/')) {
            const parsed = JSON.parse(String(body ?? '{}')) as unknown
            calls.push({ url, method, body: parsed })
            return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
          }
          throw new Error(`Unexpected ElevenLabs mock fetch: ${method} ${url}`)
        }) as typeof fetch

        const context = createElevenLabsTtsIvcContext()
        const firstDir = join(tempDir, 'first')
        const secondDir = join(tempDir, 'second')
        await mkdir(firstDir, { recursive: true })
        await mkdir(secondDir, { recursive: true })
        const clone = {
          refAudioPath: 'input/examples/audio/anthony-voice.mp3',
          voiceName: 'AutoShowTestVoice',
          removeBackgroundNoise: true,
          context
        }
        const first = await runElevenLabsTts('Hello from the first run.', firstDir, {
          model: 'eleven_v3',
          clone
        })
        const second = await runElevenLabsTts('Hello from the second run.', secondDir, {
          model: 'eleven_v3',
          clone
        })

        expect(await Bun.file(first.audioPath).exists()).toBe(true)
        expect(await Bun.file(second.audioPath).exists()).toBe(true)
        expect(calls.filter((call) => call.url.endsWith('/v1/voices/add'))).toHaveLength(1)
        expect(calls.filter((call) => call.url.includes('/v1/text-to-speech/'))).toHaveLength(2)
        expect(calls.find((call) => call.url.endsWith('/v1/voices/add'))?.body).toEqual({
          name: 'AutoShowTestVoice',
          hasFile: true,
          removeBackgroundNoise: 'true'
        })
        expect(calls.filter((call) => call.url.includes('/v1/text-to-speech/')).map((call) => ({
          url: call.url,
          body: call.body
        }))).toEqual([
          {
            url: 'https://api.elevenlabs.io/v1/text-to-speech/voice_elevenlabs_mock?output_format=mp3_44100_128',
            body: { text: 'Hello from the first run.', model_id: 'eleven_v3' }
          },
          {
            url: 'https://api.elevenlabs.io/v1/text-to-speech/voice_elevenlabs_mock?output_format=mp3_44100_128',
            body: { text: 'Hello from the second run.', model_id: 'eleven_v3' }
          }
        ])
        expect(first.metadata).toMatchObject({
          speaker: 'ref_audio:anthony-voice.mp3',
          clonedVoiceId: 'voice_elevenlabs_mock',
          cloneCostCents: 0
        })
        expect(second.metadata).toMatchObject({
          speaker: 'ref_audio:anthony-voice.mp3',
          clonedVoiceId: 'voice_elevenlabs_mock',
          cloneCostCents: 0
        })
      } finally {
        globalThis.fetch = previousFetch
        if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
        else process.env['ELEVENLABS_API_KEY'] = previousKey
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('elevenlabs clone flow fails clearly when verification is required', async () => {
      const previousKey = process.env['ELEVENLABS_API_KEY']
      const previousFetch = globalThis.fetch
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-verify-'))

      try {
        process.env['ELEVENLABS_API_KEY'] = 'test-key'
        globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
          const url = String(input)
          if (url.endsWith('/v1/voices/add')) {
            return new Response(JSON.stringify({
              voice_id: 'voice_requires_verify',
              requires_verification: true
            }), { status: 200, headers: { 'content-type': 'application/json' } })
          }
          throw new Error(`Unexpected ElevenLabs verification mock fetch: ${init?.method ?? 'GET'} ${url}`)
        }) as typeof fetch

        await expect(runElevenLabsTts('Hello.', tempDir, {
          model: 'eleven_v3',
          clone: {
            refAudioPath: 'input/examples/audio/anthony-voice.mp3',
            context: createElevenLabsTtsIvcContext()
          }
        })).rejects.toThrow('Verify it in ElevenLabs, then rerun with --elevenlabs-voice voice_requires_verify')
      } finally {
        globalThis.fetch = previousFetch
        if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
        else process.env['ELEVENLABS_API_KEY'] = previousKey
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('elevenlabs clone flow surfaces API errors without synthesis', async () => {
      const previousKey = process.env['ELEVENLABS_API_KEY']
      const previousFetch = globalThis.fetch
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-error-'))
      let synthesisCalls = 0

      try {
        process.env['ELEVENLABS_API_KEY'] = 'test-key'
        globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
          const url = String(input)
          if (url.endsWith('/v1/voices/add')) {
            return new Response(JSON.stringify({ detail: { message: 'bad reference audio' } }), {
              status: 400,
              headers: {
                'content-type': 'application/json',
                'retry-after': '7'
              }
            })
          }
          if (url.includes('/v1/text-to-speech/')) {
            synthesisCalls += 1
          }
          throw new Error(`Unexpected ElevenLabs error mock fetch: ${url}`)
        }) as typeof fetch

        try {
          await runElevenLabsTts('Hello.', tempDir, {
            model: 'eleven_v3',
            clone: {
              refAudioPath: 'input/examples/audio/anthony-voice.mp3',
              context: createElevenLabsTtsIvcContext()
            }
          })
          throw new Error('expected ElevenLabs IVC failure')
        } catch (error) {
          expect((error as Error).message).toContain('ElevenLabs IVC voice creation failed (400): bad reference audio')
          expect((error as { headers?: Headers }).headers?.get('retry-after')).toBe('7')
        }
        expect(synthesisCalls).toBe(0)
      } finally {
        globalThis.fetch = previousFetch
        if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
        else process.env['ELEVENLABS_API_KEY'] = previousKey
        await rm(tempDir, { recursive: true, force: true })
      }
    })
})
