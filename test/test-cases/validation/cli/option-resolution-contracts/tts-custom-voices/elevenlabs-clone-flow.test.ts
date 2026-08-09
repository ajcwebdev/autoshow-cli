import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { runElevenLabsTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/run-elevenlabs-tts'
import { createElevenLabsTtsIvcContext } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-ivc'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../../../test-utils/rest-contract-helpers'
import { LOCAL_SHORT_AUDIO_PATH } from './shared'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['ELEVENLABS_API_KEY'],
  tempPrefix: 'autoshow-elevenlabs-clone-flow-'
})

describe('ElevenLabs clone flow contracts', () => {
  test('elevenlabs clone flow creates once and reuses cloned voice across runs', async () => {
      const tempDir = await tempDirs.make()
        process.env['ELEVENLABS_API_KEY'] = 'test-key'
        const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()

        const calls = installMockFetch((call) => {
          if (call.url.endsWith('/v1/voices/add') && call.form !== undefined) {
            return jsonResponse({
              voice_id: 'voice_elevenlabs_mock',
              requires_verification: false
            })
          }
          if (call.url.includes('/v1/text-to-speech/')) {
            return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
          }
          throw new Error(`Unexpected ElevenLabs mock fetch: ${call.method} ${call.url}`)
        })

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
        const cloneCall = calls.find((call) => call.url.endsWith('/v1/voices/add'))
        expect(cloneCall?.form?.get('name')).toBe('AutoShowTestVoice')
        expect(cloneCall?.form?.get('files')).toBeInstanceOf(Blob)
        expect(cloneCall?.form?.get('remove_background_noise')).toBe('true')
        expect(calls.filter((call) => call.url.includes('/v1/text-to-speech/')).map((call) => ({
          url: call.url,
          body: call.bodyJson
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
    })

  test('elevenlabs clone flow fails clearly when verification is required', async () => {
      const tempDir = await tempDirs.make('autoshow-elevenlabs-verify-')

        process.env['ELEVENLABS_API_KEY'] = 'test-key'
        installMockFetch((call) => {
          if (call.url.endsWith('/v1/voices/add')) {
            return jsonResponse({
              voice_id: 'voice_requires_verify',
              requires_verification: true
            })
          }
          throw new Error(`Unexpected ElevenLabs verification mock fetch: ${call.method} ${call.url}`)
        })

        await expect(runElevenLabsTts('Hello.', tempDir, {
          model: 'eleven_v3',
          clone: {
            refAudioPath: 'input/examples/audio/anthony-voice.mp3',
            context: createElevenLabsTtsIvcContext()
          }
        })).rejects.toThrow('Verify it in ElevenLabs, then rerun with --elevenlabs-voice voice_requires_verify')
    })

  test('elevenlabs clone flow surfaces API errors without synthesis', async () => {
      const tempDir = await tempDirs.make('autoshow-elevenlabs-error-')
      let synthesisCalls = 0

        process.env['ELEVENLABS_API_KEY'] = 'test-key'
        installMockFetch((call) => {
          if (call.url.endsWith('/v1/voices/add')) {
            return new Response(JSON.stringify({ detail: { message: 'bad reference audio' } }), {
              status: 400,
              headers: {
                'content-type': 'application/json',
                'retry-after': '7'
              }
            })
          }
          if (call.url.includes('/v1/text-to-speech/')) {
            synthesisCalls += 1
          }
          throw new Error(`Unexpected ElevenLabs error mock fetch: ${call.url}`)
        })

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
    })
})
