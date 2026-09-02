import { describe, expect, test } from 'bun:test'
import type { TtsTargetInvocation } from '~/types'
import {
  normalizeTtsTurnControls,
  resolveTtsTargetInvocationControls,
  resolveTtsTurnControlOverrides,
} from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-invocation-controls'

const invocation = (controls: TtsTargetInvocation['controls']): TtsTargetInvocation => Object.freeze({
  sourceId: 'dialogue-turn-001',
  sourceIndex: 0,
  speaker: 'Alice',
  voice: Object.freeze({ kind: 'id' as const, value: 'alloy' }),
  controls: Object.freeze(controls)
})

describe('per-turn TTS invocation controls', () => {
  test('invocation controls win without mutating request defaults and null clears an optional', () => {
    const defaults = Object.freeze({ instructions: 'request default', speed: 0.8 })
    const effective = resolveTtsTargetInvocationControls(
      'openai',
      invocation({ instructions: null, speed: 1.2 }),
      defaults
    )

    expect(effective).toEqual({ speed: 1.2 })
    expect(Object.isFrozen(effective)).toBe(true)
    expect(defaults).toEqual({ instructions: 'request default', speed: 0.8 })
  })

  test('provider schemas reject unknown keys, wrong types, and out-of-range values', () => {
    expect(() => resolveTtsTargetInvocationControls(
      'openai',
      invocation({ pitch: 2 }),
      {}
    )).toThrow('does not support per-turn TTS invocation control pitch')

    expect(() => resolveTtsTargetInvocationControls(
      'openai',
      invocation({ speed: 'fast' }),
      {}
    )).toThrow('expected a finite number')

    expect(() => resolveTtsTargetInvocationControls(
      'elevenlabs',
      invocation({ speed: 1.3 }),
      {}
    )).toThrow('must be at most 1.2')
  })

  test('canonical turn maps are provider-keyed, deep-frozen, and exact', () => {
    const controls = normalizeTtsTurnControls({
      'dialogue-turn-001': {
        openai: { speed: 0.8 },
        elevenlabs: { pronunciationDictionaryLocators: ['dictionary-id:version-id'] }
      },
      'dialogue-turn-002': {
        openai: { speed: 1.2 }
      }
    }, ['dialogue-turn-001', 'dialogue-turn-002'])

    expect(controls).toBeDefined()
    expect(Object.isFrozen(controls)).toBe(true)
    expect(Object.isFrozen(controls?.['dialogue-turn-001'])).toBe(true)
    expect(Object.isFrozen(controls?.['dialogue-turn-001']?.elevenlabs)).toBe(true)
    expect(Object.isFrozen(controls?.['dialogue-turn-001']?.elevenlabs?.['pronunciationDictionaryLocators'])).toBe(true)
    expect(resolveTtsTurnControlOverrides('openai', 'dialogue-turn-002', controls)).toEqual({ speed: 1.2 })

    expect(() => normalizeTtsTurnControls({
      'dialogue-turn-003': { openai: { speed: 0.8 } }
    }, ['dialogue-turn-001', 'dialogue-turn-002'])).toThrow('unknown dialogue turn dialogue-turn-003')
  })
})
