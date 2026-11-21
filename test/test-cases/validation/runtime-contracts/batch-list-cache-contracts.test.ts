import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { getFileFingerprint } from '~/utils/file-fingerprint-cache'
import { withTempDir } from '../../../test-utils/temp-dirs'

const CACHE_NAME = 'autoshow-batch-list-cache.json'
const INPUTS = ['https://example.test/first', 'https://example.test/second']

type ProbeResult = {
  items?: string[]
  error?: { message: string, kind?: string, stage?: string, code?: string, causeCode?: string }
}

// Runtime state namespaces and module mocks are process-local so parallel suites never share this cache.
const runBatchProbe = async (
  root: string,
  filePath: string,
  options: { failWrite?: boolean, requireCacheHit?: boolean } = {}
): Promise<ProbeResult> => {
  const cliUtilsPath = resolve('src/utils/cli-utils.ts')
  const collectionPath = resolve('src/cli/commands/sources/metadata/metadata-targets/metadata-input-collection.ts')
  const source = [
    "import { mock } from 'bun:test';",
    "import { mkdir } from 'node:fs/promises';",
    'const cliUtils = await import(' + JSON.stringify(cliUtilsPath) + ');',
    'const originalFileExists = cliUtils.fileExists;',
    'mock.module(' + JSON.stringify(cliUtilsPath) + ', () => ({ ...cliUtils, fileExists: async path => {',
    'if (path === ' + JSON.stringify(filePath) + ') {',
    options.requireCacheHit ? "throw new Error('A cache hit must not probe the input again');" : '',
    options.failWrite ? 'await mkdir(' + JSON.stringify(join(root, 'cache', CACHE_NAME)) + ');' : '',
    '}',
    'return await originalFileExists(path);',
    '} }));',
    'const { readInputList } = await import(' + JSON.stringify(collectionPath) + ');',
    'try {',
    'process.stdout.write(JSON.stringify({ items: await readInputList(' + JSON.stringify(filePath) + ') }));',
    '} catch (error) {',
    'process.stdout.write(JSON.stringify({ error: { message: error.message, kind: error.kind, stage: error.stage, code: error.code, causeCode: error.cause?.code } }));',
    '}'
  ].join('\n')
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', source], {
    env: { PATH: process.env['PATH'], TMPDIR: root, AUTOSHOW_TEST_STATE_ROOT: root },
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(exitCode, stderr).toBe(0)
  return JSON.parse(stdout) as ProbeResult
}

const makeInput = async (root: string, name = 'inputs.txt', items = INPUTS) => {
  const filePath = join(root, name)
  await writeFile(filePath, items.join('\n') + '\n')
  return { filePath, entry: { items, fingerprint: await getFileFingerprint(filePath) } }
}

describe('batch input-list cache', () => {
  test('reuses a validated entry with matching source fingerprint before parsing inputs', async () => {
    await withTempDir('autoshow-batch-list-hit-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
      const { filePath, entry } = await makeInput(root)
      await writeFile(join(root, 'cache', CACHE_NAME), JSON.stringify({ [filePath]: entry }))
      expect(await runBatchProbe(root, filePath, { requireCacheHit: true })).toEqual({ items: INPUTS })
    })
  })

  for (const invalid of ['missing', 'malformed JSON', 'invalid map', 'non-string item', 'invalid fingerprint'] as const) {
    test('treats ' + invalid + ' as a cache miss and preserves source-to-items/fingerprint metadata', async () => {
      await withTempDir('autoshow-batch-list-miss-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
        const { filePath, entry } = await makeInput(root)
        const cachePath = join(root, 'cache', CACHE_NAME)
        const contents = invalid === 'missing' ? undefined
          : invalid === 'malformed JSON' ? '{'
            : invalid === 'invalid map' ? '[]'
              : JSON.stringify({ [filePath]: invalid === 'non-string item' ? { ...entry, items: [42] } : { ...entry, fingerprint: {} } })
        if (contents !== undefined) await writeFile(cachePath, contents)
        expect(await runBatchProbe(root, filePath)).toEqual({ items: INPUTS })
        expect(JSON.parse(await readFile(cachePath, 'utf8'))).toEqual({ [filePath]: entry })
        expect((await stat(cachePath)).mode & 0o777).toBe(0o600)
      })
    })
  }

  test('propagates cache read I/O failures rather than treating them as a miss', async () => {
    await withTempDir('autoshow-batch-list-read-error-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
      const { filePath } = await makeInput(root)
      await mkdir(join(root, 'cache', CACHE_NAME))
      expect(await runBatchProbe(root, filePath)).toMatchObject({ error: { code: 'EISDIR' } })
    })
  })

  test('propagates cache write I/O failures with input-list context and the original cause', async () => {
    await withTempDir('autoshow-batch-list-write-error-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
      const { filePath } = await makeInput(root)
      expect(await runBatchProbe(root, filePath, { failWrite: true })).toMatchObject({
        error: { kind: 'infrastructure', stage: 'metadata:input-list', causeCode: 'EISDIR' }
      })
    })
  })

  test('preserves every source-to-items/fingerprint relationship across concurrent processes', async () => {
    await withTempDir('autoshow-batch-list-concurrent-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
      const entries = await Promise.all(Array.from({ length: 8 }, (_, index) =>
        makeInput(root, `inputs-${index}.txt`, [`https://example.test/${index}/first`, `https://example.test/${index}/second`])
      ))
      expect(await Promise.all(entries.map(({ filePath }) => runBatchProbe(root, filePath))))
        .toEqual(entries.map(({ entry }) => ({ items: entry.items })))
      expect(JSON.parse(await readFile(join(root, 'cache', CACHE_NAME), 'utf8')))
        .toEqual(Object.fromEntries(entries.map(({ filePath, entry }) => [filePath, entry])))
      for (const { filePath, entry } of entries) {
        expect(await getFileFingerprint(filePath)).toEqual(entry.fingerprint)
        expect(await readFile(filePath, 'utf8')).toBe(entry.items.join('\n') + '\n')
      }
    })
  })
})
