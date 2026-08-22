import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import {
  planCurrentTtsReadiness,
} from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import type { TtsOptions, TtsTarget } from '~/types'
import { requireDefined } from '../../../test-utils/value-assertions'

const dialogue = [
  'Alice: First line.',
  'Bob: Second line.',
  'Alice: Third line.',
].join('\n')

const targetFor = (options: TtsOptions, service: TtsTarget['service']): TtsTarget => {
  return requireDefined(
    collectTtsTargets(options).find((candidate) => candidate.service === service),
    `${service} target fixture`
  )
}

describe('current TTS render planning uses final invocation controls', () => {
  test('plans OpenAI A/X, B/default-cleared, A/X from the exact effective serializer controls', () => {
    const defaults = buildOptsFromFlags({
      'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
      'tts-voice': 'ash',
      'tts-instructions': 'inherited instruction',
      'tts-speed': '1',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Alice=alloy', 'Bob=onyx'],
    })
    const options: TtsOptions = {
      ...defaults,
      ttsTurnControls: {
        'dialogue-turn-001': { openai: { instructions: 'X', speed: 0.8 } },
        'dialogue-turn-002': { openai: { instructions: null, speed: 1.2 } },
        'dialogue-turn-003': { openai: { instructions: 'X', speed: 0.8 } },
      },
    }
    const planned = planCurrentTtsReadiness({
      target: targetFor(options, 'openai'),
      sourceText: dialogue,
      ttsOptions: options,
    })

    expect(planned.strategy).toBe('segmented')
    const turns = planned.renderPlan.nodes.map((node) => {
      if (node.kind !== 'turn') throw new Error('Expected only canonical turn nodes')
      return node.turn
    })
    expect(turns.map((turn) => turn.providerControls.values)).toEqual([
      { instructions: 'X', speed: 0.8 },
      { speed: 1.2 },
      { instructions: 'X', speed: 0.8 },
    ])

    const requestValues = planned.renderPlan.batches.map((batch) => batch.requestControls.values)
    expect(requestValues).toEqual([
      {
        instructions: 'X',
        speed: 0.8,
        serializerControlsHash: hashCanonicalTtsValue({ responseFormat: 'wav', instructions: 'X', speed: 0.8 }),
      },
      {
        speed: 1.2,
        serializerControlsHash: hashCanonicalTtsValue({ responseFormat: 'wav', speed: 1.2 }),
      },
      {
        instructions: 'X',
        speed: 0.8,
        serializerControlsHash: hashCanonicalTtsValue({ responseFormat: 'wav', instructions: 'X', speed: 0.8 }),
      },
    ])
    expect(requestValues[0]).toEqual(requestValues[2])
    expect(requestValues[1]).not.toHaveProperty('instructions')
  })

  test('forces two-speaker Gemini through segmented planning when any turn has explicit controls', () => {
    const defaults = buildOptsFromFlags({
      'gemini-tts': 'gemini-3.1-flash-tts-preview',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Alice=Kore', 'Bob=Puck'],
    })
    const options: TtsOptions = {
      ...defaults,
      ttsTurnControls: {
        'dialogue-turn-001': { gemini: { languageCode: 'en-US' } },
        'dialogue-turn-002': { gemini: { languageCode: 'en-GB' } },
        'dialogue-turn-003': { gemini: { languageCode: 'en-US' } },
      },
    }
    const planned = planCurrentTtsReadiness({
      target: targetFor(options, 'gemini'),
      sourceText: dialogue,
      ttsOptions: options,
    })

    expect(planned.strategy).toBe('segmented')
    expect(planned.renderPlan.batches).toHaveLength(3)
    expect(planned.renderPlan.batches.map((batch) => batch.requestControls.values['serializerControlsHash'])).toEqual([
      hashCanonicalTtsValue({ responseModalities: ['AUDIO'], languageCode: 'en-US' }),
      hashCanonicalTtsValue({ responseModalities: ['AUDIO'], languageCode: 'en-GB' }),
      hashCanonicalTtsValue({ responseModalities: ['AUDIO'], languageCode: 'en-US' }),
    ])
  })
})
