import {
  describe,
  expect,
  test
} from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runSpeechifyTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/run-speechify-tts'
import { createMockWavBase64, createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import {
  LOCAL_AUDIO_PATH,
  LOCAL_SHORT_AUDIO_PATH,
  readWavSamples,
  segmentRms,
  setupTtsContractLifecycle,
  waitForCondition
} from './shared'

const { makeTempDir } = setupTtsContractLifecycle()

const readMockMp3Base64 = async (): Promise<string> =>
  Buffer.from(await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()).toString('base64')

describe('TTS provider service contracts', () => {
  test('Speechify posts authenticated JSON chunks, retries once, decodes audio, and finalizes metadata', async () => {
      const dir = await makeTempDir('autoshow-speechify-tts-')
      const audioBase64 = createMockWavBase64()
      const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []
      let attempt = 0

      process.env['SPEECHIFY_API_KEY'] = 'speechify-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          authorization: new Headers(init?.headers).get('authorization'),
          body
        })
        attempt += 1
        if (attempt === 1) {
          return new Response('try again', { status: 500 })
        }
        return Response.json({ audio_data: audioBase64 })
      }) as typeof fetch

      const result = await runSpeechifyTts('a'.repeat(2100), dir, {
        model: 'simba-3.2',
        voiceId: 'narrator_voice',
        audioFormat: 'wav',
        language: 'en-US'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        ttsService: 'speechify',
        ttsModel: 'simba-3.2',
        speaker: 'narrator_voice',
        chunkCount: 2
      })
      expect(result.metadata.audioFileSize).toBeGreaterThan(0)
      expect(calls).toHaveLength(3)
      const requestSummaries = calls.map((call) => ({
        url: call.url,
        method: call.method,
        authorization: call.authorization,
        voice: call.body['voice_id'],
        format: call.body['audio_format'],
        model: call.body['model'],
        language: call.body['language'],
        inputLength: String(call.body['input']).length
      })).sort((left, right) => Number(right.inputLength) - Number(left.inputLength))
      expect(requestSummaries).toEqual([
        {
          url: 'https://api.speechify.ai/v1/audio/speech',
          method: 'POST',
          authorization: 'Bearer speechify-key',
          voice: 'narrator_voice',
          format: 'wav',
          model: 'simba-3.2',
          language: 'en-US',
          inputLength: 2000
        },
        {
          url: 'https://api.speechify.ai/v1/audio/speech',
          method: 'POST',
          authorization: 'Bearer speechify-key',
          voice: 'narrator_voice',
          format: 'wav',
          model: 'simba-3.2',
          language: 'en-US',
          inputLength: 2000
        },
        {
          url: 'https://api.speechify.ai/v1/audio/speech',
          method: 'POST',
          authorization: 'Bearer speechify-key',
          voice: 'narrator_voice',
          format: 'wav',
          model: 'simba-3.2',
          language: 'en-US',
          inputLength: 100
        }
      ])
    }, 10_000)

  test('Speechify TTS honors chunk concurrency and preserves final audio order', async () => {
      const dir = await makeTempDir('autoshow-speechify-tts-chunk-concurrency-')
      const audioByMarker = new Map([
        ['A', createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.25, frequencyHz: 440 }).toString('base64')],
        ['B', createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.85, frequencyHz: 440 }).toString('base64')]
      ])
      const started: string[] = []
      const releases = new Map<string, () => void>()
      let releaseImmediately = false
      let inFlight = 0
      let maxInFlight = 0

      process.env['SPEECHIFY_API_KEY'] = 'speechify-key'

      globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        const marker = String(body['input'] ?? '').charAt(0)
        started.push(marker)
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        if (!releaseImmediately) {
          await new Promise<void>((resolve) => releases.set(marker, resolve))
        }
        inFlight -= 1
        return Response.json({ audio_data: audioByMarker.get(marker) })
      }) as typeof fetch

      const runPromise = runSpeechifyTts(`${'A'.repeat(2000)} ${'B'.repeat(100)}`, dir, {
        model: 'simba-3.2',
        voiceId: 'narrator_voice',
        audioFormat: 'wav',
        chunkConcurrency: 2
      })
      let waitError: unknown

      try {
        await waitForCondition(() => started.length === 2, 'Speechify chunks did not start concurrently')
        expect(started).toEqual(['A', 'B'])
        expect(maxInFlight).toBe(2)
        for (const marker of ['B', 'A']) {
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
      const first = segmentRms(samples, 0, 2)
      const second = segmentRms(samples, 1, 2)
      expect(first).toBeLessThan(second)
      expect(result.metadata.chunkCount).toBe(2)
    }, 10_000)

  test('Speechify sends both current model IDs with compatible voices and languages', async () => {
    const dir = await makeTempDir('autoshow-speechify-current-models-')
    const bodies: Array<Record<string, unknown>> = []
    process.env['SPEECHIFY_API_KEY'] = 'speechify-key'
    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
      return Response.json({ audio_data: createMockWavBase64() })
    }) as typeof fetch

    await runSpeechifyTts('Simba 3.2.', dir, { model: 'simba-3.2', voiceId: 'geffen_32', language: 'en-US' })
    await runSpeechifyTts('Simba 3.0.', dir, { model: 'simba-3.0', voiceId: 'george', language: 'fr-FR' })

    expect(bodies.map((body) => ({ model: body['model'], voice: body['voice_id'], language: body['language'] }))).toEqual([
      { model: 'simba-3.2', voice: 'geffen_32', language: 'en-US' },
      { model: 'simba-3.0', voice: 'george', language: 'fr-FR' }
    ])
  }, 10_000)

  test('Speechify custom voice creation posts multipart consent and uses the returned voice ID for synthesis', async () => {
      const dir = await makeTempDir('autoshow-speechify-custom-voice-')
      const samplePath = join(dir, 'speechify-sample.mp3')
      await Bun.$`ffmpeg -v error -y -i ${LOCAL_AUDIO_PATH} -t 12 -c copy ${samplePath}`.quiet()
      const audioBase64 = await readMockMp3Base64()
      const calls: Array<{
        url: string
        method: string
        authorization: string | null
        form?: {
          name: string
          consent: string
          sampleName: string | undefined
          sampleType: string | undefined
        }
        body?: Record<string, unknown>
      }> = []

      process.env['SPEECHIFY_API_KEY'] = 'speechify-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const authorization = new Headers(init?.headers).get('authorization')
        if (url.endsWith('/v1/voices')) {
          const form = init?.body as FormData
          const sample = form.get('sample')
          calls.push({
            url,
            method: init?.method ?? 'GET',
            authorization,
            form: {
              name: String(form.get('name')),
              consent: String(form.get('consent')),
              sampleName: sample instanceof File ? sample.name : undefined,
              sampleType: sample instanceof File ? sample.type : undefined
            }
          })
          return Response.json({ id: 'speechify_custom_voice_123' })
        }

        if (url.endsWith('/v1/audio/speech')) {
          calls.push({
            url,
            method: init?.method ?? 'GET',
            authorization,
            body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
          })
          return Response.json({ audio_data: audioBase64 })
        }

        throw new Error(`Unexpected Speechify mock fetch: ${url}`)
      }) as typeof fetch

      const result = await runSpeechifyTts('Speechify custom voice synthesis.', dir, {
        model: 'simba-3.0',
        customVoice: {
          refAudioPath: samplePath,
          voiceName: 'AutoShow Anthony',
          consentName: 'Anthony Example',
          consentEmail: 'anthony@example.com',
          locale: 'en-US',
          gender: 'notSpecified'
        }
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        ttsService: 'speechify',
        ttsModel: 'simba-3.0',
        speaker: 'ref_audio:speechify-sample.mp3',
        clonedVoiceId: 'speechify_custom_voice_123',
        cloneCostCents: 0,
        chunkCount: 1
      })
      expect(calls).toHaveLength(2)
      expect(calls[0]).toEqual({
        url: 'https://api.speechify.ai/v1/voices',
        method: 'POST',
        authorization: 'Bearer speechify-key',
        form: {
          name: 'AutoShow Anthony',
          consent: 'true',
          sampleName: 'speechify-sample.mp3',
          sampleType: 'audio/mpeg'
        }
      })
      expect(calls[1]).toMatchObject({
        url: 'https://api.speechify.ai/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer speechify-key',
        body: {
          voice_id: 'speechify_custom_voice_123',
          audio_format: 'mp3',
          model: 'simba-3.0',
          input: 'Speechify custom voice synthesis.'
        }
      })
    }, 10_000)

  test('Speechify custom voice validates audio before creation', async () => {
      const dir = await makeTempDir('autoshow-speechify-custom-voice-invalid-')
      const emptyAudio = join(dir, 'empty.mp3')
      await writeFile(emptyAudio, '')
      const calls: string[] = []

      process.env['SPEECHIFY_API_KEY'] = 'speechify-key'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        calls.push(String(input))
        return Response.json({ id: 'unexpected' })
      }) as typeof fetch

      await expect(runSpeechifyTts('Invalid custom voice.', dir, {
        model: 'simba-3.0',
        customVoice: {
          refAudioPath: emptyAudio,
          consentName: 'Anthony Example',
          consentEmail: 'anthony@example.com'
        }
      })).rejects.toThrow('reference audio is empty')
      expect(calls).toHaveLength(0)
    })
})
