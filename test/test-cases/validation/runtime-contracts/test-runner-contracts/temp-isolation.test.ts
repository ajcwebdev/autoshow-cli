import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { readInputList } from '~/cli/commands/sources/metadata/metadata-targets/metadata-input-collection'
import { childEnv } from '~/utils/child-env'
import { readJsonCacheMap } from '~/utils/file-fingerprint-cache'
import { withTempDir } from '../../../../test-utils/temp-dirs'
import { buildChildEnv } from '../../../../test-utils/test-command-options'

const BATCH_LIST_CACHE_NAME = 'autoshow-batch-list-cache.json'

const runChild = async (args: string[], env: Record<string, string | undefined>): Promise<string> => {
  const proc = Bun.spawn([process.execPath, '--no-env-file', ...args], { env, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  // CLI modules log progress to stderr, so only a failed exit makes it significant.
  if (exitCode !== 0) throw new Error(`child exited ${exitCode}: ${stderr}`)
  return stdout
}

describe('test-runner contracts', () => {
  test('each test process runs inside a private temp root', () => {
    expect(basename(tmpdir())).toStartWith('autoshow-test-tmp-')
  })

  test('batch-list cache entries from tests and their CLI children stay out of the enclosing temp cache', async () => {
    await withTempDir('autoshow-temp-isolation-', async (dir) => {
      const inProcessList = join(dir, 'in-process.txt')
      const childList = join(dir, 'child.txt')
      await Bun.write(inProcessList, 'https://example.com/in-process\n')
      await Bun.write(childList, 'https://example.com/child\n')

      expect(await readInputList(inProcessList)).toEqual(['https://example.com/in-process'])
      const modulePath = join(process.cwd(), 'src/cli/commands/sources/metadata/metadata-targets/metadata-input-collection.ts')
      const childOutput = await runChild([
        '-e',
        `const { readInputList } = await import(${JSON.stringify(modulePath)}); process.stdout.write(JSON.stringify(await readInputList(${JSON.stringify(childList)})))`
      ], buildChildEnv(undefined))
      expect(JSON.parse(childOutput)).toEqual(['https://example.com/child'])

      const privateKeys = Object.keys(await readJsonCacheMap(join(tmpdir(), BATCH_LIST_CACHE_NAME)))
      const enclosingKeys = Object.keys(await readJsonCacheMap(join(dirname(tmpdir()), BATCH_LIST_CACHE_NAME)))
      expect(privateKeys).toContain(inProcessList)
      expect(privateKeys).toContain(childList)
      expect(enclosingKeys).not.toContain(inProcessList)
      expect(enclosingKeys).not.toContain(childList)
    })
  })

  test('a child bun test process gets its own root and removes it when it finishes', async () => {
    const output = await runChild(['test', './test/test-utils/fixtures/temp-isolation-root.fixture.ts'], childEnv())
    const childRoot = output.match(/^TEMP_ROOT=(.+)$/m)?.[1] ?? ''

    expect(dirname(childRoot)).toBe(tmpdir())
    expect(basename(childRoot)).toStartWith('autoshow-test-tmp-')
    expect(existsSync(childRoot)).toBe(false)
  })
})
