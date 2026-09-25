import { describe, expect, test } from 'bun:test'
import { collectTtsTargets, preflightTtsTargetSelection } from '~/cli/commands/audio/tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

describe('Synthesis voice option contracts', () => {
  test('allows existing voice IDs', () => {
    const elevenLabs = buildOptsFromFlags({
      'elevenlabs-tts': 'eleven_v3',
      'tts-voice': 'voice_existing'
    })
    const inworld = buildOptsFromFlags({
      'inworld-tts': 'realtime-tts-2',
      'tts-voice': 'voice_existing'
    })
    expect(() => preflightTtsTargetSelection(elevenLabs)).not.toThrow()
    expect(() => preflightTtsTargetSelection(inworld)).not.toThrow()
    expect(collectTtsTargets(elevenLabs)[0]?.voice).toBe('voice_existing')
    expect(collectTtsTargets(inworld)[0]?.voice).toBe('voice_existing')
  })
})
