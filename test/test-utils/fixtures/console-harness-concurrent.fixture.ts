import { expect, test } from 'bun:test'

test.concurrent('concurrent passing noisy harness sample', async () => {
  console.log('HARNESS_CONCURRENT_PASS_LOG')
  await Bun.sleep(20)
  expect(1).toBe(1)
})

test.concurrent('concurrent failing noisy harness sample', async () => {
  console.log('HARNESS_CONCURRENT_FAIL_LOG')
  await Bun.sleep(10)
  expect(1).toBe(2)
})
