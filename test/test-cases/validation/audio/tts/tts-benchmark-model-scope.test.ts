import { expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { SUPPORTED_CARTESIA_TTS_MODELS, validateCartesiaTtsModel, SUPPORTED_INWORLD_TTS_MODELS, validateInworldTtsModel } from '~/cli/commands/setup-and-utilities/models/tts-models'

test('benchmark exclusions do not remove the retained OpenAI and Speechify CLI targets', async () => {
  const options = buildOptsFromFlags({ 'openai-tts': 'gpt-4o-mini-tts-2025-12-15', 'speechify-tts': 'simba-3.2', 'cartesia-tts': true })
  expect(collectTtsTargets(options).map(t => [t.service, t.model])).toEqual(expect.arrayContaining([
    ['openai', 'gpt-4o-mini-tts-2025-12-15'], ['speechify', 'simba-3.2'], ['cartesia', 'sonic-3.6-2026-08-27'],
  ]))
  expect(SUPPORTED_CARTESIA_TTS_MODELS).toEqual(['sonic-3.6-2026-08-27'])
  expect(() => validateCartesiaTtsModel('sonic-3.5-2026-05-04')).toThrow('Model "sonic-3.5-2026-05-04" is retired for --provider/--tts cartesia[=model]. Use "sonic-3.6-2026-08-27" instead.')
  expect(SUPPORTED_INWORLD_TTS_MODELS).toEqual(['realtime-tts-2'])
  expect(() => validateInworldTtsModel('realtime-tts-2-flash')).toThrow('Model "realtime-tts-2-flash" is retired for --provider/--tts inworld[=model]. Use "realtime-tts-2" instead.')
  const ledger = await Bun.file('test/fixtures/tts-controls/benchmark-plan.json').json()
  for (const [suite, count] of [['emotion', 5], ['speed-pauses', 11]] as const) {
    const source = await Bun.file(`test/fixtures/tts-controls/${suite}/benchmark-plan.json`).json()
    const slug = suite === 'emotion' ? '2026-09-12_05-tts-emotion' : '2026-09-12_06-tts-speed-pauses'
    const retained = await Bun.file(`${ledger.outputBase ?? 'docs/benchmarks/tts'}/${slug}/benchmark-plan.json`).json()
    // Historical paid inputs must remain immutable when a broken active fixture is corrected.
    expect(source.cases.map((entry: { id: string }) => entry.id)).toEqual(retained.cases.map((entry: { id: string }) => entry.id))
    expect(source.cases).toHaveLength(count)
    for (const entry of source.cases) {
      expect(['openai', 'speechify']).not.toContain(entry.provider)
      if (entry.provider === 'inworld') expect(entry.model).toBe('realtime-tts-2')
      if (entry.provider === 'cartesia') expect(entry.model).toBe('sonic-3.6-2026-08-27')
    }
  }
})
