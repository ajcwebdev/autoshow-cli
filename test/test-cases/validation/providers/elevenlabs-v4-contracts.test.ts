import { runSingleTtsInput } from '~/cli/commands/audio/tts/tts-single-run'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { dispatchResume } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { createHostedTtsChunkScheduler } from '~/cli/commands/audio/tts/tts-utils/hosted-tts-chunk-scheduler'
import { afterEach, describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { runElevenLabsTts } from '~/cli/commands/audio/tts/tts-services/tts-elevenlabs/run-elevenlabs-tts'
import { runElevenLabsNativeDialogue, planElevenLabsNativeDialogueBatches } from '~/cli/commands/audio/tts/tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import { buildProviderSerializerDescriptor } from '~/cli/commands/audio/tts/script-to-audio/provider-serializer-registry'
import { planCurrentTtsReadiness } from '~/cli/commands/audio/tts/script-to-audio/current-render-attempt'
import { resolveTtsChunkCharacterLimit } from '~/cli/commands/audio/tts/tts-utils/tts-chunking'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { preflightTtsText } from '~/cli/commands/audio/tts/tts-targets/tts-text-preflight'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

// Independent provider expectations checked 2026-10-29:
// https://elevenlabs.io/docs/overview/models#character-limits (v4 TTS: 10,000)
// https://elevenlabs.io/docs/eleven-api/quickstart (explicit TTS eleven_v4)
// https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4
// https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps
// Dialogue uses settings.similarity, total 2,000 characters and at most 10 voices.
const dirs = setupContractSuiteLifecycle({ envKeys: ['ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-eleven-v4-' })
afterEach(resetPinnedRunDir)
const audio = createMockWavBytes()
const turns = [{ turnId: 'one', subjectKey: 'narrator', speaker: 'Narrator', canonicalText: 'Hello there.', voiceId: 'voice-a' }]

describe('Eleven v4 local transport and decoded integrity; no spoken or perceptual claim', () => {
  test('explicit selection, retained bare default, limits and immutable native model identity', () => {
    expect(resolveCheapestModelForFlag('elevenlabs-tts')).toBe('eleven_v3')
    expect(resolveTtsChunkCharacterLimit('elevenlabs', 'eleven_v4')).toBe(10_000)
    const opts = buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v4', 'tts-speaker': ['Narrator=voice-a'], 'tts-dialogue-format': 'labeled' })
    const target = collectTtsTargets(opts)[0]!
    expect(target.model).toBe('eleven_v4')
    const descriptor = buildProviderSerializerDescriptor(target, 'voice-a', { stability: 0.4, similarityBoost: 0.8 }, 'native-dialogue')
    expect(descriptor.controls).toEqual({ outputFormat: 'mp3_44100_128', modelId: 'eleven_v4', settings: { stability: 0.4, similarity: 0.8 } })
    const plan = planCurrentTtsReadiness({ target, sourceText: 'Narrator: Hello there.', ttsOptions: opts })
    expect(JSON.stringify(plan)).toContain('eleven_v4')
    expect(JSON.stringify(plan)).not.toContain('eleven_v3')
    expect(() => preflightTtsText('Hello <break time="1s"/> there.', [target], true)).toThrow('does not support SSML')
    expect(planElevenLabsNativeDialogueBatches([{ ...turns[0]!, canonicalText: 'x'.repeat(2000) }, turns[0]!])).toHaveLength(2)
    expect(() => planElevenLabsNativeDialogueBatches([{ ...turns[0]!, canonicalText: 'x'.repeat(2001) }])).toThrow('2000-character')
  })

  test('native dialogue actual target dispatch preserves v4 and similarity, then resets controls', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'fixture'
    const calls = installMockFetch(() => Response.json({ audio_base64: audio.toString('base64'), voice_segments: [{ dialogue_input_index: 0, start_time_seconds: 0, end_time_seconds: 0.1 }] }))
    for (const controls of [{ 'tts-stability': 'elevenlabs=0.4', 'tts-similarity': 'elevenlabs=0.8' }, {}]) {
      const opts = buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v4', 'tts-speaker': ['Narrator=voice-a'], 'tts-dialogue-format': 'labeled', ...controls })
      await runTtsForTargets('Narrator: Hello there.', await dirs.make(), opts, collectTtsTargets(opts))
    }
    expect(calls).toHaveLength(2)
    expect(calls[0]?.url).toBe('https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps?output_format=mp3_44100_128')
    expect(calls[0]?.bodyJson).toEqual({ inputs: [{ text: 'Hello there.', voice_id: 'voice-a' }], model_id: 'eleven_v4', settings: { stability: 0.4, similarity: 0.8 } })
    expect(calls[1]?.bodyJson).toEqual({ inputs: [{ text: 'Hello there.', voice_id: 'voice-a' }], model_id: 'eleven_v4' })
  })

  test('completed v4 native audio resumes from purchased slots without repeat dispatch or changed identity', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'fixture'
    const root = await dirs.make(), input = `${root}/source.txt`, output = `${root}/output`
    await Bun.write(input, 'Narrator: Hello there.')
    configurePinnedRunDir(output)
    const calls = installMockFetch(() => Response.json({ audio_base64: audio.toString('base64') }))
    const opts = { ...buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v4', 'tts-speaker': ['Narrator=voice-a'], 'tts-dialogue-format': 'labeled', 'tts-similarity': 'elevenlabs=0.8' }), batchConcurrency: 1, price: false, allowOverBudget: false }
    await runSingleTtsInput(input, opts, collectTtsTargets(opts), undefined)
    const before = JSON.stringify(await readManifest(output))
    expect(calls).toHaveLength(1)
    await dispatchResume(output, { price: true })
    await dispatchResume(output, {})
    expect(calls).toHaveLength(1)
    const manifest = await readManifest(output)
    expect(manifest?.items[0]?.status).toBe('full')
    expect(before).toContain('eleven_v4')
    expect(JSON.stringify(manifest)).toContain('eleven_v4')
    expect(JSON.stringify(manifest)).not.toContain('eleven_v3')
  })

  test('single voice actual dispatch accepts documented controls with default, override and reset', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'fixture'
    const calls = installMockFetch(() => new Response(audio))
    for (const controls of [undefined, { voiceSettings: { stability: 0.4, similarity_boost: 0.8 }, responseFormat: 'wav_48000' }, undefined]) {
      const result = await runElevenLabsTts('Hello there.', await dirs.make(), { model: 'eleven_v4', voiceId: 'voice-a', controls, chunkScheduler: createHostedTtsChunkScheduler({ maxConcurrency: 1, concurrencyMode: 'immediate' }) })
      expect((await Bun.file(result.audioPath).bytes()).slice(0, 4)).toEqual(new TextEncoder().encode('RIFF'))
    }
    expect(calls.map(call => call.bodyJson?.['model_id'])).toEqual(['eleven_v4', 'eleven_v4', 'eleven_v4'])
    expect(calls[1]?.bodyJson?.['voice_settings']).toEqual({ stability: 0.4, similarity_boost: 0.8 })
    expect(calls[1]?.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice-a?output_format=wav_48000')
    expect(calls[2]?.bodyJson?.['voice_settings']).toBeUndefined()
  })

  test('explicit speaker boost false and true reject for both v3 and v4 in target validation', () => {
    for (const model of ['eleven_v3', 'eleven_v4']) for (const value of ['false', 'true']) {
      expect(() => collectTtsTargets(buildOptsFromFlags({ 'elevenlabs-tts': model, 'tts-speaker-boost': `elevenlabs=${value}` }))).toThrow('use_speaker_boost')
    }
  })

  for (const voiceSettings of [{ speed: 1 }, { style: 0.2 }, { use_speaker_boost: false }]) {
    test(`unsupported ${Object.keys(voiceSettings)[0]} rejects before credentials or transport`, async () => {
      delete process.env['ELEVENLABS_API_KEY']
      const calls = installMockFetch(() => { throw new Error('unexpected dispatch') })
      await expect(runElevenLabsTts('Hello.', await dirs.make(), { model: 'eleven_v4', controls: { voiceSettings } })).rejects.toThrow('Eleven v4')
      await expect(runElevenLabsNativeDialogue(turns, await dirs.make(), { model: 'eleven_v4', controls: { voiceSettings } })).rejects.toThrow('Eleven v4')
      expect(calls).toHaveLength(0)
    })
  }

  for (const payload of [null, { audio_base64: '%%%=' }, { audio_base64: Buffer.from('not audio').toString('base64') }, { audio_base64: audio.toString('base64'), voice_segments: [{ dialogue_input_index: 0, start_time_seconds: 0.2, end_time_seconds: 0.1 }] }]) {
    test(`HTTP success rejects malformed response/artifact ${JSON.stringify(payload).slice(0, 50)}`, async () => {
      process.env['ELEVENLABS_API_KEY'] = 'fixture'
      const calls = installMockFetch(() => Response.json(payload))
      await expect(runElevenLabsNativeDialogue(turns, await dirs.make(), { model: 'eleven_v4' })).rejects.toThrow()
      expect(calls).toHaveLength(1)
    })
  }
})
