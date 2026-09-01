import { expect, test } from 'bun:test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const retryStatePath = process.env['AUTOSHOW_JUNIT_RETRY_STATE']

test('passes on its retry', async () => {
  if (!retryStatePath) throw new Error('AUTOSHOW_JUNIT_RETRY_STATE is required')
  const attempt = existsSync(retryStatePath)
    ? Number.parseInt(readFileSync(retryStatePath, 'utf8'), 10) + 1
    : 1
  writeFileSync(retryStatePath, String(attempt))
  await Bun.sleep(12)
  expect(attempt).toBe(2)
})

test('keeps its final failure message', async () => {
  await Bun.sleep(8)
  throw new Error('JUNIT_FINAL_FAILURE')
})
