import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'

describe('Speechify custom voice option contracts', () => {
  test('Speechify custom voice creation is rejected during synthesis option resolution', () => {
      expect(() => buildOptsFromFlags(false, {
        'speechify-tts': 'simba-3.0',
        'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
        'speechify-tts-voice-name': 'AutoShow Anthony',
        'speechify-tts-consent-name': 'Anthony Example',
        'speechify-tts-consent-email': 'anthony@example.com',
        'speechify-tts-voice-locale': 'en-US',
        'speechify-tts-voice-gender': 'notSpecified'
      }, {}, new Set(['speechify-tts-ref-audio']))).toThrow('cannot perform reference-audio cloning during TTS synthesis')
    })

  test('Speechify synthesis accepts an already provisioned voice ID', () => {
      const options = buildOptsFromFlags(false, {
        'speechify-tts': 'simba-3.2',
        'speechify-voice': 'approved_clone_123'
      })

      expect(collectTtsTargets(options).map(target => target.voice)).toEqual(['approved_clone_123'])
    })
})
