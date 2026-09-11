import { expect } from 'bun:test'

// Matchers report the value and context; this signature also preserves narrowing.
export function requireCondition(value: unknown, message?: string): asserts value {
  expect(value, message).toBeTruthy()
}
