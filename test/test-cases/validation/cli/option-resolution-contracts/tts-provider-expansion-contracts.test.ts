import { describe, expect, test } from 'bun:test'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { TtsProvider } from '~/types'

const ACTIVE_TTS_PROVIDERS = ['elevenlabs', 'minimax', 'grok', 'mistral', 'openai', 'speechify', 'hume', 'cartesia', 'fish', 'inworld', 'deepinfra'] as const

describe('option resolution contracts', () => {
  test('--all-tts expands exactly the active provider registry', () => {
    const opts = buildOptsFromFlags({ 'all-tts': true })
    const selections: Record<TtsProvider, readonly string[] | undefined> = {
      elevenlabs: opts.elevenlabsTtsModels, minimax: opts.minimaxTtsModels, grok: opts.grokTtsModels,
      mistral: opts.mistralTtsModels, openai: opts.openaiTtsModels, speechify: opts.speechifyTtsModels,
      hume: opts.humeTtsModels, cartesia: opts.cartesiaTtsModels, fish: opts.fishTtsModels,
      inworld: opts.inworldTtsModels, deepinfra: opts.deepinfraTtsModels,
    }
    expect(Object.entries(selections).filter(([, models]) => (models?.length ?? 0) > 0).map(([provider]) => provider)).toEqual([...ACTIVE_TTS_PROVIDERS])
    for (const retired of ['groq', 'gemini', 'deepgram', 'replicate', 'fal']) expect(selections).not.toHaveProperty(retired)
  })

  test('--all-tts rejects special-input modes that need explicit references', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags({
      'all-tts': true,
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Host=input/examples/audio/anthony-voice.mp3']
    }))).toThrow('--tts-speaker SPEAKER=path mappings cannot enter generic TTS runtime options')
  })
})
