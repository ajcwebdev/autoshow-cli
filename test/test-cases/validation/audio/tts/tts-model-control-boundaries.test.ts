import { expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { planCurrentTtsReadiness } from '~/cli/commands/audio/tts/script-to-audio/current-render-attempt'
import { runElevenLabsTts } from '~/cli/commands/audio/tts/tts-services/tts-elevenlabs/run-elevenlabs-tts'
import { validateTtsBenchmarkContent } from '~/tools/tts-benchmark-content'
import type { ElevenLabsTtsVoiceSettings, TtsOptions } from '~/types'
import { createMockWavBytes } from '../../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: ['ELEVENLABS_API_KEY'], tempPrefix: 'tts-model-boundaries-' })
const audio = createMockWavBytes()

// Provider contracts checked 2026-09-12; expected wire fields are deliberately literal.
// https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps
test('native dialogue preserves stability, dictionaries and exact spoken words', async () => {
  process.env['ELEVENLABS_API_KEY'] = 'fixture'
  const calls = installMockFetch(() => Response.json({
    audio_base64: audio.toString('base64'),
    voice_segments: [{ voice_id: 'voice-a', dialogue_input_index: 0, start_time_seconds: 0, end_time_seconds: 0.1 }],
  }))
  const opts = buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3', 'tts-dialogue-format': 'labeled', 'tts-speaker': ['Narrator=voice-a'], 'tts-stability': 'elevenlabs=0.5', 'tts-pronunciation-dictionary': ['elevenlabs=dictionary-a:version-a'] })
  await runTtsForTargets('Narrator: Hello there.', await dirs.make(), opts, collectTtsTargets(opts))
  expect(calls).toHaveLength(1)
  expect(calls[0]?.url).toBe('https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps?output_format=mp3_44100_128')
  expect(calls[0]?.bodyJson).toEqual({
    inputs: [{ text: 'Hello there.', voice_id: 'voice-a' }], model_id: 'eleven_v3',
    settings: { stability: 0.5 }, pronunciation_dictionary_locators: [{ pronunciation_dictionary_id: 'dictionary-a', version_id: 'version-a' }],
  })
})

// https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech
for (const settings of [{ speed: 1 }, { similarity_boost: 0.8 }, { use_speaker_boost: false }, { style: 0.2 }] satisfies ElevenLabsTtsVoiceSettings[]) {
  test(`v3 direct adapter rejects unsupported ${Object.keys(settings)[0]} without a request`, async () => {
    process.env['ELEVENLABS_API_KEY'] = 'fixture'
    const calls = installMockFetch(() => new Response(audio))
    await expect(runElevenLabsTts('Only these words.', await dirs.make(), { model: 'eleven_v3', controls: { voiceSettings: settings } })).rejects.toThrow('Eleven v3')
    expect(calls).toHaveLength(0)
  })
}

test('unsupported per-turn v3 controls fail in planning, before any request', () => {
  const calls = installMockFetch(() => new Response(audio))
  for (const controls of [{ similarityBoost: 0.8 }, { useSpeakerBoost: false }, { style: 0.2 }]) {
    const opts: TtsOptions = { ...buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3' }), ttsTurnControls: { 'dialogue-turn-001': { elevenlabs: controls } } }
    expect(() => planCurrentTtsReadiness({ target: collectTtsTargets(opts)[0]!, sourceText: 'Only these words.', ttsOptions: opts })).toThrow('Eleven v3')
  }
  expect(calls).toHaveLength(0)
})

test('benchmark validation catches bracketed prose and changed spoken words independently of HTTP success', () => {
  const entry = { id: 'fixture', provider: 'elevenlabs', lines: Array(5).fill('[whispers] I am whispering.'), spokenLines: Array(5).fill('I am whispering.') }
  expect(() => validateTtsBenchmarkContent(entry)).not.toThrow()
  expect(() => validateTtsBenchmarkContent({ ...entry, lines: Array(5).fill('[whispering softly, as if sharing a private secret] I am whispering.') })).toThrow('bracketed prose')
  expect(() => validateTtsBenchmarkContent({ ...entry, spokenLines: Array(5).fill('Say something else.') })).toThrow('canonical spoken words')
})
