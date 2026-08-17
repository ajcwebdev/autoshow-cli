import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

describe('Mistral saved voice option contracts', () => {
  test('raw Mistral request references are rejected from generic runtime option resolution', () => {
      expect(() => buildOptsFromFlags(false, {
        'mistral-tts': 'voxtral-mini-tts-2603',
        'mistral-tts-voice': 'voice_abc123',
        'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
      }, {}, new Set(['mistral-tts-ref-audio']))).toThrow('authorized edge input only for the standalone `tts` command')
    })
})
