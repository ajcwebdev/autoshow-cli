import { expect, test } from 'bun:test'

test('passing noisy harness sample', () => {
  console.log('HARNESS_PASS_LOG')
  expect(1).toBe(1)
})

test('failing noisy harness sample', () => {
  console.log('HARNESS_FAIL_LOG')
  expect(1).toBe(2)
})
