import { describe, expect, test } from 'bun:test'
import type { LLMService } from '~/types'
import { resolveStructuredStrategy, resolveValidationRetryBudget, shouldApplyStrictMode } from '~/cli/commands/text/write/structured-output/capabilities'

describe('structured output provider capability contracts', () => {
  test('OpenAI uses native strict structured output', () => {
    expect(resolveStructuredStrategy('openai')).toBe('native')
    expect(shouldApplyStrictMode('openai', true)).toBe(true)
  })

  test('every provider has an explicit validation retry budget', () => {
    const expected: Record<LLMService, number> = {
      openai: 0,
      anthropic: 1,
      gemini: 1,
      grok: 0,
    }

    for (const [service, budget] of Object.entries(expected) as Array<[LLMService, number]>) {
      expect(resolveValidationRetryBudget(service)).toBe(budget)
    }
  })
})
