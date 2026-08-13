import {
  describe,
  expect,
  test
} from 'bun:test'
import { join } from 'node:path'
import { runElevenLabsTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/run-elevenlabs-tts'
import { runMistralTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-mistral/run-mistral-tts'
import { runTts } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { resolveTtsChunkCharacterLimit } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import type { TtsOptions } from '~/types'
import { createMockWavBase64, createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { installMockFetch } from '../../../../test-utils/rest-contract-helpers'
import { LOCAL_AUDIO_PATH, LOCAL_SHORT_AUDIO_PATH, readWavSamples, segmentRms, setupTtsContractLifecycle, waitForCondition } from './shared'

const { makeTempDir } = setupTtsContractLifecycle()

describe('TTS provider service contracts', () => {
  test('Mistral converts a protected non-mp3-wav reference to WAV before sending ref_audio', async () => {
      const dir = await makeTempDir('autoshow-mistral-tts-ref-audio-')
      const sourcePath = join(dir, 'reference.m4a')

      await Bun.$`ffmpeg -v error -y -i ${LOCAL_SHORT_AUDIO_PATH} -t 1 -c:a aac ${sourcePath}`.quiet()

      process.env['MISTRAL_API_KEY'] = 'mistral-key'

      const calls = installMockFetch(() => Response.json({ audio_data: createMockWavBase64() }))

      const result = await runMistralTts('Mistral reference synthesis.', dir, {
        model: 'voxtral-mini-tts-2603',
        refAudioPath: sourcePath,
        protectedReference: {
          assetId: 'sha256_fixture_reference',
          sourceExtension: '.m4a'
        }
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.headers.get('authorization')).toBe('Bearer mistral-key')
      expect(calls[0]).toMatchObject({
        url: 'https://api.mistral.ai/v1/audio/speech',
        method: 'POST'
      })
      expect(calls[0]?.bodyJson).toMatchObject({
        model: 'voxtral-mini-tts-2603',
        input: 'Mistral reference synthesis.',
        stream: false,
        response_format: 'wav'
      })

      const refAudio = String(calls[0]?.bodyJson?.['ref_audio'])
      const refBytes = Buffer.from(refAudio, 'base64')
      expect(refBytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(refBytes.subarray(8, 12).toString('ascii')).toBe('WAVE')
      expect(await Bun.file(join(dir, 'mistral-reference-audio.wav')).exists()).toBe(false)
      expect(result.metadata).toMatchObject({
        ttsService: 'mistral',
        ttsModel: 'voxtral-mini-tts-2603',
        speaker: 'ref_audio:sha256_fixture_reference',
        chunkCount: 1
      })
    }, 10_000)

  test('Mistral multi-speaker reference paths fail locally before provider execution', async () => {
      const dir = await makeTempDir('autoshow-mistral-tts-dialogue-ref-audio-')
      process.env['MISTRAL_API_KEY'] = 'mistral-key'

      const calls = installMockFetch(() => Response.json({ audio_data: createMockWavBase64() }))

      await expect(runTts([
        'Host: Welcome to the reference audio test.',
        'Guest: Thanks. I should use the guest sample.'
      ].join('\n'), dir, {
        mistralTtsModels: ['voxtral-mini-tts-2603'],
        ttsDialogueFormat: 'labeled',
        ttsSpeakers: [
          `Host=${LOCAL_SHORT_AUDIO_PATH}`,
          `Guest=${LOCAL_AUDIO_PATH}`
        ]
      } as TtsOptions)).rejects.toThrow('must cross protected ingestion as exact per-speaker opaque assets')

      expect(calls).toHaveLength(0)
    }, 10_000)

  test('ElevenLabs TTS sends output format, voice settings, seed, text normalization, and pronunciation dictionaries controls', async () => {
      const dir = await makeTempDir('autoshow-elevenlabs-tts-controls-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()

      process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'

      const calls = installMockFetch(() => new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } }))

      const result = await runElevenLabsTts('ElevenLabs control synthesis.', dir, {
        model: 'eleven_v3',
        voiceId: 'voice_existing123',
        controls: {
          outputFormat: 'mp3_22050_32',
          languageCode: 'en',
          voiceSettings: {
            stability: 0.4,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
            speed: 1.1
          },
          seed: 12345,
          textNormalization: 'on',
          pronunciationDictionaryLocators: ['dict_1:version_2', 'dict_3'],
          optimizeStreamingLatency: 2
        }
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.headers.get('xi-api-key')).toBe('elevenlabs-key')
      expect(calls[0]?.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice_existing123?output_format=mp3_22050_32&optimize_streaming_latency=2')
      expect(calls[0]?.method).toBe('POST')
      expect(calls[0]?.bodyJson).toEqual({
        text: 'ElevenLabs control synthesis.',
        model_id: 'eleven_v3',
        language_code: 'en',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
          speed: 1.1
        },
        seed: 12345,
        apply_text_normalization: 'on',
        pronunciation_dictionary_locators: [
          {
            pronunciation_dictionary_id: 'dict_1',
            version_id: 'version_2'
          },
          {
            pronunciation_dictionary_id: 'dict_3'
          }
        ]
      })
      expect(result.metadata.chunkCount).toBe(1)
    }, 10_000)

  test('ElevenLabs sends new model IDs and resolves model-specific character limits', async () => {
    const dir = await makeTempDir('autoshow-elevenlabs-new-models-')
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'
    const calls = installMockFetch(() => {
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    })

    for (const model of ['eleven_multilingual_v2', 'eleven_flash_v2_5'] as const) {
      await runElevenLabsTts('New ElevenLabs model.', dir, { model, voiceId: 'voice_existing123' })
    }

    expect(calls.map((call) => call.bodyJson?.['model_id'])).toEqual(['eleven_multilingual_v2', 'eleven_flash_v2_5'])
    expect(resolveTtsChunkCharacterLimit('elevenlabs', 'eleven_v3')).toBe(5000)
    expect(resolveTtsChunkCharacterLimit('elevenlabs', 'eleven_multilingual_v2')).toBe(10000)
    expect(resolveTtsChunkCharacterLimit('elevenlabs', 'eleven_flash_v2_5')).toBe(40000)
  }, 10_000)

  test('ElevenLabs TTS splits long text into multiple API calls', async () => {
      const dir = await makeTempDir('autoshow-elevenlabs-tts-chunks-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'

      const calls = installMockFetch(() => {
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      })

      const result = await runElevenLabsTts(`${'A'.repeat(5000)} ${'B'.repeat(100)}`, dir, {
        model: 'eleven_v3',
        voiceId: 'voice_existing123'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        ttsService: 'elevenlabs',
        ttsModel: 'eleven_v3',
        speaker: 'voice_existing123',
        chunkCount: 2
      })
      expect(calls).toHaveLength(2)
      expect(calls.every((call) => call.url === 'https://api.elevenlabs.io/v1/text-to-speech/voice_existing123?output_format=mp3_44100_128')).toBe(true)
      expect(calls.map((call) => String(call.bodyJson?.['text']).length)).toEqual([5000, 100])
    }, 10_000)

  test('ElevenLabs TTS runs chunks concurrently and concatenates in chunk order', async () => {
      const dir = await makeTempDir('autoshow-elevenlabs-tts-chunk-concurrency-')
      const audioByMarker = new Map([
        ['A', createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.2, frequencyHz: 440 })],
        ['B', createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.5, frequencyHz: 440 })],
        ['C', createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.9, frequencyHz: 440 })]
      ])
      const started: string[] = []
      const releases = new Map<string, () => void>()
      let releaseImmediately = false
      let inFlight = 0
      let maxInFlight = 0

      process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'

      installMockFetch(async (call) => {
        const marker = String(call.bodyJson?.['text'] ?? '').charAt(0)
        started.push(marker)
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        if (!releaseImmediately) {
          await new Promise<void>((resolve) => releases.set(marker, resolve))
        }
        inFlight -= 1
        return new Response(audioByMarker.get(marker) ?? createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.1, frequencyHz: 440 }), {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' }
        })
      })

      const runPromise = runElevenLabsTts(`${'A'.repeat(5000)} ${'B'.repeat(5000)} ${'C'.repeat(100)}`, dir, {
        model: 'eleven_v3',
        voiceId: 'voice_existing123',
        chunkConcurrency: 3
      })
      let waitError: unknown

      try {
        await waitForCondition(() => started.length === 3, 'ElevenLabs chunks did not start concurrently')
        expect(started).toEqual(['A', 'B', 'C'])
        expect(maxInFlight).toBe(3)
        for (const marker of ['C', 'B', 'A']) {
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
      const rmsValues = [0, 1, 2].map((index) => segmentRms(samples, index, 3))
      expect(rmsValues[0] as number).toBeLessThan(rmsValues[1] as number)
      expect(rmsValues[1] as number).toBeLessThan(rmsValues[2] as number)
      expect(result.metadata.chunkCount).toBe(3)
    }, 10_000)

})
