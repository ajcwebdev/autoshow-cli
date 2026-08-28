import { describe,expect,test } from 'bun:test'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import {
getGroqDefaultTtsVoiceForModel,
GROK_DEFAULT_TTS_VOICE
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { assertNoVoiceIdentityWithDialogue } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

const INVALID_GROQ_TTS_MODEL = 'canopylabs/orpheus-legacy'

describe('option resolution contracts', () => {

  test('dialogue voice-identity guard is derived for every generic target and only rejects explicit values', () => {
    const dialogue = { ttsSpeakers: ['HOST=Jasper'] }

    expect(() => assertNoVoiceIdentityWithDialogue(dialogue, new Set(['tts-voice'])))
      .toThrow('--tts-voice cannot be combined with --tts-speaker/--tts-dialogue-format')
    expect(() => assertNoVoiceIdentityWithDialogue(dialogue, new Set(['tts-ref-audio'])))
      .toThrow('Voice identity options such as --tts-ref-audio cannot be combined')

    expect(() => assertNoVoiceIdentityWithDialogue(dialogue, new Set(['tts-speaker']))).not.toThrow()
    expect(() => assertNoVoiceIdentityWithDialogue({ ttsSpeakers: undefined }, new Set(['tts-voice']))).not.toThrow()
  })

  test('Groq TTS exposes English Orpheus voices and retires the Arabic selector', () => {
      const englishTargets = collectTtsTargets(buildOptsFromFlags({
        'groq-tts': 'canopylabs/orpheus-v1-english'
      })).filter((target) => target.service === 'groq')
      const explicitEnglishTargets = collectTtsTargets(buildOptsFromFlags({
        'groq-tts': 'canopylabs/orpheus-v1-english',
        'tts-voice': 'HANNAH'
      })).filter((target) => target.service === 'groq')

      expect(getGroqDefaultTtsVoiceForModel('canopylabs/orpheus-v1-english')).toBe('troy')
      expect(englishTargets.map((target) => target.voice)).toEqual(['troy'])
      expect(explicitEnglishTargets.map((target) => target.voice)).toEqual(['hannah'])
      expect(() => collectTtsTargets(buildOptsFromFlags({
        'groq-tts': INVALID_GROQ_TTS_MODEL
      }))).toThrow(`Invalid model "${INVALID_GROQ_TTS_MODEL}" for --provider/--tts groq[=model]`)
      expect(() => collectTtsTargets(buildOptsFromFlags({
        'groq-tts': 'canopylabs/orpheus-v1-english',
        'tts-voice': 'noura'
      }))).toThrow('Invalid --tts-voice groq="noura"')
    })

  test('grok tts voice validation normalizes case', () => {
      const opts = buildOptsFromFlags({
        'grok-tts': ['grok-tts'],
        'tts-voice': 'EVE'
      })
      const targets = collectTtsTargets(opts).filter((target) => target.service === 'grok')

      expect(opts.grokTtsVoice).toBe(GROK_DEFAULT_TTS_VOICE)
      expect(targets.map((target) => target.voice)).toEqual([GROK_DEFAULT_TTS_VOICE])
    })
})
