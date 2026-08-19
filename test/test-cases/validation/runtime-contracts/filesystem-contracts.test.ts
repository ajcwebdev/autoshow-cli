import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeExecutable, walkPaths } from '~/utils/filesystem'
import { fileExists } from '~/utils/cli-utils'

const tempDirs: string[] = []

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-filesystem-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('filesystem helpers', () => {
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
