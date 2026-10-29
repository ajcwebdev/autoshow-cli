import { createHostedTtsChunkScheduler } from '~/cli/commands/audio/tts/tts-utils/hosted-tts-chunk-scheduler'
import {
  describe,
  expect,
  test
} from 'bun:test'
import { runElevenLabsTts } from '~/cli/commands/audio/tts/tts-services/tts-elevenlabs/run-elevenlabs-tts'
import { runElevenLabsNativeDialogue } from '~/cli/commands/audio/tts/tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import { resolveTtsChunkCharacterLimit } from '~/cli/commands/audio/tts/tts-utils/tts-chunking'
import { estimateTtsCosts } from '~/cli/commands/audio/tts/tts-utils/tts-pricing'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { createSyntheticWavBytes } from '../../../../../test-utils/media-fixtures'
import { installMockFetch } from '../../../../../test-utils/rest-contract-helpers'
import {
  captureGatedAssertions,
  LOCAL_SHORT_AUDIO_PATH,
  readWavSamples,
  segmentRms,
  setupTtsContractLifecycle,
  waitForCondition
} from './shared'

const { makeTempDir } = setupTtsContractLifecycle()

describe('TTS provider service contracts', () => {

  test('ElevenLabs TTS sends the baked output format, voice settings, seed, text normalization, and pronunciation dictionaries controls', async () => {
      const dir = await makeTempDir('autoshow-elevenlabs-tts-controls-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()

      process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'

      const calls = installMockFetch(() => new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } }))

      const result = await runElevenLabsTts('ElevenLabs control synthesis.', dir, {
        chunkScheduler: createHostedTtsChunkScheduler({ maxConcurrency: 4, concurrencyMode: 'immediate' }),
        model: 'eleven_v3',
        voiceId: 'voice_existing123',
        controls: {
          languageCode: 'en',
          voiceSettings: {
            stability: 0.4
          },
          seed: 12345,
          textNormalization: 'on',
          pronunciationDictionaryLocators: ['dict_1:version_2', 'dict_3']
        }
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.headers.get('xi-api-key')).toBe('elevenlabs-key')
      expect(calls[0]?.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice_existing123?output_format=mp3_44100_128')
      expect(calls[0]?.method).toBe('POST')
      expect(calls[0]?.bodyJson).toEqual({
        text: 'ElevenLabs control synthesis.',
        model_id: 'eleven_v3',
        language_code: 'en',
        voice_settings: {
          stability: 0.4
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

  test('Eleven v3 mocked speech transport decodes WAV and accounts for 1,000 characters at eight cents', async () => {
    const dir = await makeTempDir('autoshow-elevenlabs-new-models-')
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'
    const calls = installMockFetch(() => {
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    })

    const text = 'A'.repeat(1000)
    const result = await runElevenLabsTts(text, dir, { chunkScheduler: createHostedTtsChunkScheduler({ maxConcurrency: 4, concurrencyMode: 'immediate' }), model: 'eleven_v3', voiceId: 'voice_existing123' })

    expect(calls.map((call) => call.bodyJson?.['model_id'])).toEqual(['eleven_v3'])
    expect(calls[0]?.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice_existing123?output_format=mp3_44100_128')
    expect(calls[0]?.bodyJson?.['text']).toBe(text)
    expect((await readWavSamples(result.audioPath)).length).toBeGreaterThan(0)
    expect(resolveTtsChunkCharacterLimit('elevenlabs', 'eleven_v3')).toBe(5000)
    // Oracle: https://elevenlabs.io/pricing/api, checked 2026-10-26: $0.08/1K characters.
    expect(estimateTtsCosts(buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3' }), 1000)[0]?.totalCost).toBe(8)
    expect(computeActualCosts({ step4: [result.metadata], ttsCharacterCount: 1000 }).totalCost).toBe(8)
  }, 10_000)

  test('Eleven v3 mocked split speech transport decodes WAV and accounts for 6,000 characters at 48 cents', async () => {
      const dir = await makeTempDir('autoshow-elevenlabs-tts-chunks-')
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
      process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'

      const calls = installMockFetch(() => {
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      })

      const result = await runElevenLabsTts(`${'A'.repeat(5000)}${'B'.repeat(1000)}`, dir, {
        chunkScheduler: createHostedTtsChunkScheduler({ maxConcurrency: 4, concurrencyMode: 'immediate' }),
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
      expect(calls.map((call) => String(call.bodyJson?.['text']).length)).toEqual([5000, 1000])
      expect(calls.map((call) => call.bodyJson?.['model_id'])).toEqual(['eleven_v3', 'eleven_v3'])
      expect((await readWavSamples(result.audioPath)).length).toBeGreaterThan(0)
      expect(estimateTtsCosts(buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3' }), 6000)[0]?.totalCost).toBe(48)
      expect(computeActualCosts({ step4: [result.metadata], ttsCharacterCount: 6000 }).totalCost).toBe(48)
    }, 10_000)

  test('Eleven v3 mocked native dialogue dispatch preserves voice IDs, decodes WAV, and values 3,000 input characters at 24 cents', async () => {
    const dir = await makeTempDir('autoshow-elevenlabs-dialogue-tariff-')
    const audio = Buffer.from(createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 440 })).toString('base64')
    process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'
    const calls = installMockFetch(() => Response.json({ audio_base64: audio }))
    const opts = buildOptsFromFlags({
      'elevenlabs-tts': 'eleven_v3',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Alice=voice-a', 'Bob=voice-b']
    })
    const target = collectTtsTargets(opts)[0]
    if (!target) throw new Error('Missing explicit Eleven v3 target')
    const result = await target.run(`Alice: ${'A'.repeat(1000)}\nBob: ${'B'.repeat(1000)}\nAlice: ${'C'.repeat(1000)}`, dir, opts)

    // Native API contract: https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps.
    // The documented 2,000-character request boundary produces two requests, without a per-request tariff.
    expect(calls).toHaveLength(2)
    expect(calls.every(call => call.url === 'https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps?output_format=mp3_44100_128')).toBe(true)
    expect(calls.every(call => call.method === 'POST')).toBe(true)
    expect(calls.map(call => call.bodyJson)).toEqual([
      { model_id: 'eleven_v3', inputs: [{ text: 'A'.repeat(1000), voice_id: 'voice-a' }, { text: 'B'.repeat(1000), voice_id: 'voice-b' }] },
      { model_id: 'eleven_v3', inputs: [{ text: 'C'.repeat(1000), voice_id: 'voice-a' }] }
    ])
    expect(result.metadata.chunkCount).toBe(2)
    expect((await readWavSamples(result.audioPath)).length).toBeGreaterThan(0)
    expect(estimateTtsCosts(opts, 3000)[0]?.totalCost).toBe(24)
    expect(computeActualCosts({ step4: [result.metadata], ttsCharacterCount: 3000 }).totalCost).toBe(24)
  }, 10_000)

  for (const endpoint of ['speech', 'native-dialogue'] as const) {
    test(`Eleven v3 mocked ${endpoint} HTTP success rejects an undecodable audio artifact`, async () => {
      const dir = await makeTempDir('autoshow-elevenlabs-invalid-audio-')
      process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'
      const invalidAudio = Buffer.from('This is deliberately not encoded audio.')
      const calls = installMockFetch(() => endpoint === 'speech'
        ? new Response(invalidAudio, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        : Response.json({ audio_base64: invalidAudio.toString('base64') }))
      const operation = endpoint === 'speech'
        ? runElevenLabsTts('Only these words.', dir, {
          model: 'eleven_v3',
          chunkScheduler: createHostedTtsChunkScheduler({ maxConcurrency: 1, concurrencyMode: 'immediate' })
        })
        : runElevenLabsNativeDialogue([
          { turnId: 'one', subjectKey: 'alice', speaker: 'Alice', canonicalText: 'Only these words.', voiceId: 'voice-a' }
        ], dir, { model: 'eleven_v3' })
      await expect(operation).rejects.toThrow(/Failed to convert ElevenLabs(?:-dialogue)? audio to WAV/)
      expect(calls).toHaveLength(1)
    }, 10_000)
  }

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
        chunkScheduler: createHostedTtsChunkScheduler({ maxConcurrency: 4, concurrencyMode: 'immediate' }),
        model: 'eleven_v3',
        voiceId: 'voice_existing123',
        chunkConcurrency: 3
      })
      const rethrowGatedAssertions = await captureGatedAssertions(async () => {
        await waitForCondition(() => started.length === 3, 'ElevenLabs chunks did not start concurrently')
        expect(started).toEqual(['A', 'B', 'C'])
        expect(maxInFlight).toBe(3)
        for (const marker of ['C', 'B', 'A']) {
          releases.get(marker)?.()
        }
      }, () => {
        releaseImmediately = true
        for (const release of releases.values()) release()
      })

      const result = await runPromise
      rethrowGatedAssertions()

      const samples = await readWavSamples(result.audioPath)
      const rmsValues = [0, 1, 2].map((index) => segmentRms(samples, index, 3))
      expect(rmsValues[0] as number).toBeLessThan(rmsValues[1] as number)
      expect(rmsValues[1] as number).toBeLessThan(rmsValues[2] as number)
      expect(result.metadata.chunkCount).toBe(3)
    }, 10_000)

})
