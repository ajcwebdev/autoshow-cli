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
  for (const [suite, count] of [['emotion', 6], ['speed-pauses', 9]] as const) {
    const source = await Bun.file(`test/fixtures/tts-controls/${suite}/benchmark-plan.json`).json()
    expect(source.cases.filter((entry: { provider: string }) => !['gemini', 'soniox'].includes(entry.provider)).map((entry: { id: string }) => entry.id)).toEqual(suite === 'emotion'
      ? ['elevenlabs-eleven-v3-tags', 'grok-grok-tts-delivery', 'inworld-realtime-tts-2-instructions']
      : ['elevenlabs-eleven-v3-pacing-tags', 'grok-grok-tts-numeric', 'grok-grok-tts-tags', 'inworld-realtime-tts-2-steering-tags', 'inworld-realtime-tts-2-instructions'])
    expect(source.cases.filter((entry: { provider: string }) => entry.provider === 'gemini').map((entry: { model: string }) => entry.model)).toEqual(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'])
    expect(source.cases.filter((entry: { provider: string }) => entry.provider === 'soniox').map((entry: { id: string }) => entry.id)).toEqual(suite === 'emotion' ? ['soniox-tts-rt-v2-emotion-tags'] : ['soniox-tts-rt-v2-pacing-tags', 'soniox-tts-rt-v2-numeric'])
    expect(source.cases).toHaveLength(count)
    for (const entry of source.cases) {
      expect(['openai']).not.toContain(entry.provider)
      if (entry.provider === 'inworld') expect(entry.model).toBe('realtime-tts-2')
    }
  }
})
