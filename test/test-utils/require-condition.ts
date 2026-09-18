import { expect } from 'bun:test'

export function requireCondition(value: unknown, message?: string): asserts value {
  expect(value, message).toBeTruthy()
}
