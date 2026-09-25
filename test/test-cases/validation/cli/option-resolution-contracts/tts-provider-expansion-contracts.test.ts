import { describe, expect, test } from 'bun:test'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { TtsProvider } from '~/types'

const ACTIVE_TTS_PROVIDERS = ['gemini', 'elevenlabs', 'soniox', 'grok', 'mistral', 'openai', 'inworld'] as const

describe('option resolution contracts', () => {
  test('--all-tts expands exactly the active provider registry', () => {
    const opts = buildOptsFromFlags({ 'all-tts': true })
    const selections: Record<TtsProvider, readonly string[] | undefined> = {
      gemini: opts.geminiTtsModels,
      elevenlabs: opts.elevenlabsTtsModels, soniox: opts.sonioxTtsModels, grok: opts.grokTtsModels,
      mistral: opts.mistralTtsModels, openai: opts.openaiTtsModels,
      inworld: opts.inworldTtsModels,
    }
    expect(Object.entries(selections).filter(([, models]) => (models?.length ?? 0) > 0).map(([provider]) => provider)).toEqual([...ACTIVE_TTS_PROVIDERS])
    for (const retired of ['minimax', 'deepgram', 'replicate', 'fal', 'fish', 'deepinfra']) expect(selections).not.toHaveProperty(retired)
  })

  test('--all-tts rejects special-input modes that need explicit references', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags({
      'all-tts': true,
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Host=input/examples/audio/anthony-voice.mp3']
    }))).toThrow('--tts-speaker SPEAKER=path mappings cannot enter generic TTS runtime options')
  })
})
