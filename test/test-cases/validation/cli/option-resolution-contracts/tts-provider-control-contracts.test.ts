import { describe,expect,test } from 'bun:test'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

describe('option resolution contracts', () => {

  test('Speechify validates model-specific languages and accepts provisioned voice IDs', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags({
      'speechify-tts': 'simba-3.2',
      'tts-language': 'es-ES'
    }))).toThrow('supports only en or en-*')
    expect(() => collectTtsTargets(buildOptsFromFlags({
      'speechify-tts': 'simba-3.2',
      'tts-voice': 'george'
    }))).toThrow('not compatible with simba-3.2')
    expect(collectTtsTargets(buildOptsFromFlags({
      'speechify-tts': 'simba-3.2',
      'tts-voice': 'approved_clone_123'
    }))[0]?.voice).toBe('approved_clone_123')
    expect(() => collectTtsTargets(buildOptsFromFlags({
      'speechify-tts': 'simba-3.0',
      'tts-language': 'ja-JP'
    }))).toThrow('Model "simba-3.0" is retired for --provider/--tts speechify[=model]. Use "simba-3.2" instead.')
  })

  test('Hume and Cartesia TTS target collection preserves model and voice controls', () => {
      const targets = collectTtsTargets(buildOptsFromFlags({
        'hume-tts': 'octave-2',
        'cartesia-tts': 'sonic-3.5-2026-05-04',
        'tts-voice': ['hume=Studio Voice', 'cartesia=cartesia-voice-id'],
        'tts-language': 'cartesia=en'
      }))

      expect(targets.map((target) => ({
        service: target.service,
        model: target.model,
        voice: target.voice
      }))).toEqual([
        {
          service: 'hume',
          model: 'octave-2',
          voice: 'Studio Voice'
        },
        {
          service: 'cartesia',
          model: 'sonic-3.5-2026-05-04',
          voice: 'cartesia-voice-id'
        }
      ])
    })

})
