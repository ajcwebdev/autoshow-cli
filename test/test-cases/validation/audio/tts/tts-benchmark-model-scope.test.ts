import { expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { SUPPORTED_INWORLD_TTS_MODELS, validateInworldTtsModel } from '~/cli/commands/setup-and-utilities/models/tts-models'

test('benchmark exclusions do not remove the retained OpenAI CLI target', async () => {
  const options = buildOptsFromFlags({ 'openai-tts': 'gpt-4o-mini-tts-2025-12-15' })
  expect(collectTtsTargets(options).map(t => [t.service, t.model])).toEqual(expect.arrayContaining([
    ['openai', 'gpt-4o-mini-tts-2025-12-15'],
  ]))
  expect(SUPPORTED_INWORLD_TTS_MODELS).toEqual(['realtime-tts-2'])
  expect(() => validateInworldTtsModel('realtime-tts-2-flash')).toThrow('Model "realtime-tts-2-flash" is retired for --provider/--tts inworld[=model]. Use "realtime-tts-2" instead.')
  const ledger = await Bun.file('test/fixtures/tts-controls/benchmark-plan.json').json()
  for (const [suite, count] of [['emotion', 6], ['speed-pauses', 9]] as const) {
    const source = await Bun.file(`test/fixtures/tts-controls/${suite}/benchmark-plan.json`).json()
    const slug = suite === 'emotion' ? '2026-09-12_05-tts-emotion' : '2026-09-12_06-tts-speed-pauses'
    const retained = await Bun.file(`${ledger.outputBase ?? 'docs/benchmarks/tts'}/${slug}/benchmark-plan.json`).json()
    // Historical paid inputs must remain immutable when a broken active fixture is corrected.
    expect(source.cases.filter((entry: { provider: string }) => !['gemini', 'soniox'].includes(entry.provider)).map((entry: { id: string }) => entry.id)).toEqual(retained.cases.map((entry: { id: string }) => entry.id))
    expect(source.cases.filter((entry: { provider: string }) => entry.provider === 'gemini').map((entry: { model: string }) => entry.model)).toEqual(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'])
    expect(source.cases.filter((entry: { provider: string }) => entry.provider === 'soniox').map((entry: { id: string }) => entry.id)).toEqual(suite === 'emotion' ? ['soniox-tts-rt-v2-emotion-tags'] : ['soniox-tts-rt-v2-pacing-tags', 'soniox-tts-rt-v2-numeric'])
    expect(source.cases).toHaveLength(count)
    for (const entry of source.cases) {
      expect(['openai']).not.toContain(entry.provider)
      if (entry.provider === 'inworld') expect(entry.model).toBe('realtime-tts-2')
    }
  }
})
