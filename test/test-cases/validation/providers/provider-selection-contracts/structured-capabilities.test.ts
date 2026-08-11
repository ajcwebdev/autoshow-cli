import { describe, expect, test } from 'bun:test'
import type { LLMService } from '~/types'
import { resolveStructuredStrategy, resolveValidationRetryBudget, shouldApplyStrictMode } from '~/cli/commands/process-steps/step-3-write/structured-output/capabilities'

describe('structured output provider capability contracts', () => {
  test('Together uses native strict structured output', () => {
    expect(resolveStructuredStrategy('together')).toBe('native')
    expect(shouldApplyStrictMode('together', true)).toBe(true)
  })

  test('Cerebras uses native strict structured output', () => {
    expect(resolveStructuredStrategy('cerebras')).toBe('native')
    expect(shouldApplyStrictMode('cerebras', true)).toBe(true)
  })

  test('local llama.cpp servers use native non-strict structured output', () => {
    for (const service of ['llama.cpp', 'llamafile'] as const) {
      expect(resolveStructuredStrategy(service)).toBe('native')
      expect(shouldApplyStrictMode(service, true)).toBe(false)
      expect(resolveValidationRetryBudget(service)).toBe(2)
    }
  })

  test('every provider has an explicit validation retry budget', () => {
    const expected: Record<LLMService, number> = {
      openai: 0,
      groq: 0,
      anthropic: 1,
      gemini: 1,
      minimax: 2,
      grok: 0,
      glm: 1,
      kimi: 1,
      together: 1,
      cerebras: 1,
      'llama.cpp': 2,
      llamafile: 2
    }

    for (const [service, budget] of Object.entries(expected) as Array<[LLMService, number]>) {
      expect(resolveValidationRetryBudget(service)).toBe(budget)
    }
  })
})
