import { describe, expect, test } from 'bun:test'
import { resolveStructuredStrategy, shouldApplyStrictMode } from '~/cli/commands/process-steps/step-3-write/structured-output/capabilities'

describe('structured output provider capability contracts', () => {
  test('Together uses native strict structured output', () => {
    expect(resolveStructuredStrategy('together')).toBe('native')
    expect(shouldApplyStrictMode('together', true)).toBe(true)
  })

  test('Cerebras uses native strict structured output', () => {
    expect(resolveStructuredStrategy('cerebras')).toBe('native')
    expect(shouldApplyStrictMode('cerebras', true)).toBe(true)
  })
})
