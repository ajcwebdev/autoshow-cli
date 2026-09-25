import { describe,expect,test } from 'bun:test'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

describe('option resolution contracts', () => {

  test('Speechify validates model-specific languages and accepts provisioned voice IDs', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags({
      'speechify-tts': 'simba-3.2',
      'tts-language': 'es-ES'
    }))).toThrow('supports only en or en-*')
    expect(collectTtsTargets(buildOptsFromFlags({
      'speechify-tts': 'simba-3.2',
      'tts-voice': 'george'
    }))[0]?.voice).toBe('george')
    expect(collectTtsTargets(buildOptsFromFlags({
      'speechify-tts': 'simba-3.2',
      'tts-voice': 'approved_clone_123'
    }))[0]?.voice).toBe('approved_clone_123')
    expect(() => collectTtsTargets(buildOptsFromFlags({
      'speechify-tts': 'simba-3.0',
      'tts-language': 'ja-JP'
    }))).toThrow('Model "simba-3.0" is retired for --provider/--tts speechify[=model]. Use "simba-3.2" instead.')
  })

})
