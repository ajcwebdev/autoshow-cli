import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'

describe('Speechify custom voice option contracts', () => {
  test('Speechify synthesis accepts an already provisioned voice ID', () => {
      const options = buildOptsFromFlags(false, {
        'speechify-tts': 'simba-3.2',
        'speechify-voice': 'approved_clone_123'
      })

      expect(collectTtsTargets(options).map(target => target.voice)).toEqual(['approved_clone_123'])
    })
})
