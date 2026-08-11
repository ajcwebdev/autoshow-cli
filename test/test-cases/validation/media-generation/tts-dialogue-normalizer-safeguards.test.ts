import { describe, expect, test } from 'bun:test'
import {
  normalizeDialogueText,
  parseSpeakerVoiceMappings
} from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'
import { validateTtsInput } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import type { TtsOptions } from '~/types'

const registry = parseSpeakerVoiceMappings([
  'Alice=alloy',
  'Bob=onyx'
])

describe('generic dialogue normalization safeguards', () => {
  test('labeled input retains exact leading delivery while preserving normalized output', () => {
    const normalized = normalizeDialogueText(
      'Alice: (softly,  then firmly) Keep going.',
      'labeled',
      registry
    )

    expect(normalized.normalizedText).toBe('Alice: (softly, then firmly) Keep going.')
    expect(normalized.turns).toEqual([{
      speaker: 'Alice',
      text: '(softly, then firmly) Keep going.',
      delivery: {
        kind: 'parenthetical',
        sourceText: '(softly,  then firmly)',
        descriptions: ['softly,  then firmly']
      }
    }])
  })

  test('screenplay input retains inline, cue, and block delivery without speaking it', () => {
    const normalized = normalizeDialogueText([
      'ALICE (softly) Keep moving.',
      '',
      'BOB (V.O.)',
      '(over radio) Almost there.'
    ].join('\n'), 'screenplay', registry)

    expect(normalized.normalizedText).toBe([
      'Alice: Keep moving.',
      'Bob: Almost there.'
    ].join('\n'))
    expect(normalized.turns).toEqual([
      {
        speaker: 'Alice',
        text: 'Keep moving.',
        delivery: {
          kind: 'parenthetical',
          sourceText: '(softly)',
          descriptions: ['softly']
        }
      },
      {
        speaker: 'Bob',
        text: 'Almost there.',
        delivery: {
          kind: 'parenthetical',
          sourceText: '(V.O.)\n(over radio)',
          descriptions: ['V.O.', 'over radio']
        }
      }
    ])
  })

  test('screenplay input rejects inline and standalone unmapped speaking roles', () => {
    for (const source of [
      'NARRATOR: Welcome to the show.',
      ['NARRATOR', '(warmly)', 'Welcome to the show.'].join('\n'),
      ['ALICE', 'Hello.', 'BOB', 'Hi.'].join('\n')
    ]) {
      expect(() => normalizeDialogueText(source, 'screenplay', parseSpeakerVoiceMappings([
        'Alice=alloy'
      ]))).toThrow('No --tts-speaker mapping found for speaker')
    }
  })

  test('static input validation rejects zero speakable turns and delivery-only lines', () => {
    const options: TtsOptions = {
      ttsDialogueFormat: 'screenplay',
      ttsSpeakers: ['Alice=alloy']
    }

    expect(() => validateTtsInput([
      'INT. EMPTY ROOM - NIGHT',
      '',
      'A door closes.'
    ].join('\n'), options)).toThrow('Dialogue TTS found no dialogue turns')

    expect(() => normalizeDialogueText(
      'Alice: (silently)',
      'labeled',
      parseSpeakerVoiceMappings(['Alice=alloy'])
    )).toThrow('Dialogue text contains delivery but no spoken text')
  })
})
