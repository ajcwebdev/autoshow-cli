import { expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { OUTPUT_DIR, testWorkerScratchSegment } from '../test-helpers'

test('parallel failing harness sample', async () => {
  const installed = globalThis as typeof globalThis & { [key: symbol]: true | undefined }
  expect(installed[Symbol.for('autoshow.testConsoleHarness')]).toBe(true)
  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(join(OUTPUT_DIR, 'parallel-fail.txt'), `${process.pid}\n${process.env['BUN_TEST_WORKER_ID'] ?? ''}\n`)
  console.log('HARNESS_PARALLEL_FAIL_LOG')
  expect(OUTPUT_DIR).toEndWith(testWorkerScratchSegment())
  expect('parallel failure').toBe('parallel success')
})
