import { expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

test('reports the private temp root while it exists', () => {
  expect(existsSync(tmpdir())).toBe(true)
  process.stdout.write(`TEMP_ROOT=${tmpdir()}\n`)
})
