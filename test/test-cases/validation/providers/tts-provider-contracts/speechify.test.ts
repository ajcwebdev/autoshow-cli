import {
  describe,
  expect,
  test
} from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runSpeechifyTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/run-speechify-tts'
import { ensureSpeechifyTtsCustomVoice } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-custom-voices'
import { createMockWavBase64, createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import {
  LOCAL_AUDIO_PATH,
  LOCAL_SHORT_AUDIO_PATH,
  installMockFetch,
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
      let attempt = 0

      process.env['SPEECHIFY_API_KEY'] = 'speechify-key'

      const calls = installMockFetch(() => {
        attempt += 1
        if (attempt === 1) {
          return new Response('try again', { status: 500 })
        }
        return Response.json({ audio_data: audioBase64 })
      })

      const result = await runSpeechifyTts('a'.repeat(2100), dir, {
        model: 'simba-3.2',
        voiceId: 'narrator_voice',
        audioFormat: 'wav',
        language: 'en-US',
        allowAmbiguousRedispatch: true
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
        authorization: call.headers.get('authorization'),
        voice: call.bodyJson?.['voice_id'],
        format: call.bodyJson?.['audio_format'],
        model: call.bodyJson?.['model'],
        language: call.bodyJson?.['language'],
        inputLength: String(call.bodyJson?.['input']).length
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

      installMockFetch(async (call) => {
        const marker = String(call.bodyJson?.['input'] ?? '').charAt(0)
        started.push(marker)
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        if (!releaseImmediately) {
          await new Promise<void>((resolve) => releases.set(marker, resolve))
        }
        inFlight -= 1
        return Response.json({ audio_data: audioByMarker.get(marker) })
      })

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

  test('Speechify sends the current model ID with a compatible English voice', async () => {
    const dir = await makeTempDir('autoshow-speechify-current-models-')
    process.env['SPEECHIFY_API_KEY'] = 'speechify-key'
    const calls = installMockFetch(() => {
      return Response.json({ audio_data: createMockWavBase64() })
    })

    await runSpeechifyTts('Simba 3.2.', dir, { model: 'simba-3.2', voiceId: 'geffen_32', language: 'en-US' })

    expect(calls.map((call) => ({ model: call.bodyJson?.['model'], voice: call.bodyJson?.['voice_id'], language: call.bodyJson?.['language'] }))).toEqual([
      { model: 'simba-3.2', voice: 'geffen_32', language: 'en-US' }
    ])
  }, 10_000)

  test('the separate Speechify management helper posts consent and synthesis consumes only the returned voice ID', async () => {
      const dir = await makeTempDir('autoshow-speechify-custom-voice-')
      const samplePath = join(dir, 'speechify-sample.mp3')
      await Bun.$`ffmpeg -v error -y -i ${LOCAL_AUDIO_PATH} -t 12 -c copy ${samplePath}`.quiet()
      const audioBase64 = await readMockMp3Base64()
      process.env['SPEECHIFY_API_KEY'] = 'speechify-key'

      const calls = installMockFetch((call) => {
        if (call.url.endsWith('/v1/voices')) {
          return Response.json({ id: 'speechify_custom_voice_123' })
        }

        if (call.url.endsWith('/v1/audio/speech')) {
          return Response.json({ audio_data: audioBase64 })
        }

        throw new Error(`Unexpected Speechify mock fetch: ${call.url}`)
      })

      const customVoice = await ensureSpeechifyTtsCustomVoice(
        'https://api.speechify.ai',
        'speechify-key',
        {
          refAudioPath: samplePath,
          voiceName: 'AutoShow Anthony',
          consentName: 'Anthony Example',
          consentEmail: 'anthony@example.com',
          locale: 'en-US',
          gender: 'notSpecified'
        }
      )
      const result = await runSpeechifyTts('Speechify custom voice synthesis.', dir, {
        model: 'simba-3.2',
        voiceId: customVoice.voiceId
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        ttsService: 'speechify',
        ttsModel: 'simba-3.2',
        speaker: 'speechify_custom_voice_123',
        chunkCount: 1
      })
      expect(calls).toHaveLength(2)
      expect(calls[0]).toMatchObject({
        url: 'https://api.speechify.ai/v1/voices',
        method: 'POST'
      })
      expect(calls[0]?.headers.get('authorization')).toBe('Bearer speechify-key')
      expect(calls[0]?.form?.get('name')).toBe('AutoShow Anthony')
      expect(calls[0]?.form?.get('locale')).toBe('en-US')
      expect(calls[0]?.form?.get('gender')).toBe('not_specified')
      expect(calls[0]?.form?.get('consent')).toBe(JSON.stringify({ fullName: 'Anthony Example', email: 'anthony@example.com' }))
      const sample = calls[0]?.form?.get('sample')
      expect(sample).toMatchObject({ name: 'speechify-sample.mp3', type: 'audio/mpeg' })
      expect(calls[1]).toMatchObject({
        url: 'https://api.speechify.ai/v1/audio/speech',
        method: 'POST',
        bodyJson: {
          voice_id: 'speechify_custom_voice_123',
          audio_format: 'mp3',
          model: 'simba-3.2',
          input: 'Speechify custom voice synthesis.'
        }
      })
      expect(calls[1]?.headers.get('authorization')).toBe('Bearer speechify-key')
    }, 10_000)

  test('Speechify custom voice validates audio before creation', async () => {
      const dir = await makeTempDir('autoshow-speechify-custom-voice-invalid-')
      const emptyAudio = join(dir, 'empty.mp3')
      await writeFile(emptyAudio, '')
      process.env['SPEECHIFY_API_KEY'] = 'speechify-key'

      const calls = installMockFetch(() => Response.json({ id: 'unexpected' }))

      await expect(ensureSpeechifyTtsCustomVoice(
        'https://api.speechify.ai',
        'speechify-key',
        {
          refAudioPath: emptyAudio,
          consentName: 'Anthony Example',
          consentEmail: 'anthony@example.com'
        }
      )).rejects.toThrow('reference audio is empty')
      expect(calls).toHaveLength(0)
    })
})
