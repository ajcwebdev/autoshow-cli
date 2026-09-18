import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { statPath as stat } from '~/utils/bun-file-io'
import { join } from 'node:path'
import { isPathAbsenceError, makeExecutable, pathExists, walkPaths } from '~/utils/filesystem'
import { fileExists } from '~/utils/cli-utils'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const tempDirs = createTempDirTracker('autoshow-filesystem-')
const makeTempDir = tempDirs.make

afterEach(tempDirs.cleanup)

describe('filesystem helpers', () => {

  test('pathExists and fileExists share absence-code policy', async () => {
    expect(await pathExists('/tmp/autoshow-definitely-missing-' + crypto.randomUUID())).toBe(false)
    expect(await fileExists('/tmp/autoshow-definitely-missing-' + crypto.randomUUID())).toBe(false)
    expect(isPathAbsenceError(Object.assign(new Error('missing'), { code: 'ENOENT' }))).toBe(true)
    expect(isPathAbsenceError(Object.assign(new Error('denied'), { code: 'EACCES' }))).toBe(false)
  })
  test('fileExists treats an overlong non-path string as missing', async () => {
    expect(await fileExists('not-a-path '.repeat(1024))).toBe(false)
  })

  test('walkPaths honors kind and maxDepth', async () => {
    const root = await makeTempDir()
    await mkdir(join(root, 'one', 'two'), { recursive: true })
    await writeFile(join(root, 'root.txt'), 'root')
    await writeFile(join(root, 'one', 'one.txt'), 'one')
    await writeFile(join(root, 'one', 'two', 'two.txt'), 'two')

    expect((await walkPaths(root, { kind: 'file', maxDepth: 1 })).map((path) => path.replace(`${root}/`, '')).sort())
      .toEqual(['root.txt'])
    expect((await walkPaths(root, { kind: 'file', maxDepth: 2 })).map((path) => path.replace(`${root}/`, '')).sort())
      .toEqual(['one/one.txt', 'root.txt'])
  })

  test('makeExecutable applies executable mode', async () => {
    const root = await makeTempDir()
    const script = join(root, 'tool')
    await writeFile(script, '#!/bin/sh\nexit 0\n')

    await makeExecutable(script)

    expect((await stat(script)).mode & 0o111).toBeGreaterThan(0)
  })
})
