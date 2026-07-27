import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'

describe('Mistral saved voice option contracts', () => {
  test('mistral tts voice and reference audio are mutually exclusive at target collection', () => {
      const opts = buildOptsFromFlags(false, {
        'mistral-tts': 'voxtral-mini-tts-2603',
        'mistral-tts-voice': 'voice_abc123',
        'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
      })

      expect(() => collectTtsTargets(opts)).toThrow('Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both')
    })

  test('mistral tts voice name creates a saved-voice target from reference audio', () => {
      const opts = buildOptsFromFlags(false, {
        'mistral-tts': 'voxtral-mini-tts-2603',
        'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
        'mistral-tts-voice-name': 'AutoShow Saved Voice'
      })
      const targets = collectTtsTargets(opts).filter((target) => target.service === 'mistral')

      expect(opts.mistralTtsVoiceName).toBe('AutoShow Saved Voice')
      expect(targets.map((target) => ({
        model: target.model,
        voice: target.voice
      }))).toEqual([{
        model: 'voxtral-mini-tts-2603',
        voice: 'saved_voice:AutoShow Saved Voice'
      }])
      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'mistral-tts': 'voxtral-mini-tts-2603',
        'mistral-tts-voice-name': 'AutoShow Saved Voice'
      }))).toThrow('requires --mistral-tts-ref-audio')
    })
})
