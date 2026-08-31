import { describe, expect, test } from 'bun:test'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { GROK_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { assertNoVoiceIdentityWithDialogue } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

describe('option resolution contracts', () => {
  test('dialogue voice-identity guard rejects only explicit conflicting values', () => {
    const dialogue = { ttsSpeakers: ['HOST=Jasper'] }
    expect(() => assertNoVoiceIdentityWithDialogue(dialogue, new Set(['tts-voice']))).toThrow('--tts-voice cannot be combined')
    expect(() => assertNoVoiceIdentityWithDialogue(dialogue, new Set(['tts-speaker']))).not.toThrow()
  })

  test('Grok TTS voice validation normalizes case', () => {
    const opts = buildOptsFromFlags({ 'grok-tts': ['grok-tts'], 'tts-voice': 'EVE' })
    const targets = collectTtsTargets(opts).filter(target => target.service === 'grok')
    expect(opts.grokTtsVoice).toBe(GROK_DEFAULT_TTS_VOICE)
    expect(targets.map(target => target.voice)).toEqual([GROK_DEFAULT_TTS_VOICE])
  })
})
