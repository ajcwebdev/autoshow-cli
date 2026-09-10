import { describe, expect, test } from 'bun:test'
import type { LLMService } from '~/types'
import { resolveStructuredStrategy, resolveValidationRetryBudget, shouldApplyStrictMode } from '~/cli/commands/text/write/structured-output/capabilities'

describe('structured output provider capability contracts', () => {
  test('Together uses native strict structured output', () => {
    expect(resolveStructuredStrategy('together')).toBe('native')
    expect(shouldApplyStrictMode('together', true)).toBe(true)
  })

  test('every provider has an explicit validation retry budget', () => {
    const expected: Record<LLMService, number> = {
      openai: 0,
      anthropic: 1,
      gemini: 1,
      minimax: 2,
      grok: 0,
      glm: 1,
      kimi: 1,
      together: 1,
    }

    for (const [service, budget] of Object.entries(expected) as Array<[LLMService, number]>) {
      expect(resolveValidationRetryBudget(service)).toBe(budget)
    }
  })
})
