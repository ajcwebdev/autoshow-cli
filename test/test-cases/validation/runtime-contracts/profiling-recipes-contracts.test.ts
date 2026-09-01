import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

describe('Bun profiling recipes', () => {
  test('package scripts keep every profiling recipe outside provider environments', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as { scripts?: Record<string, string> }
    for (const name of ['profile:cpu', 'profile:heap', 'profile:bundle', 'profile:tokenizer', 'profile:all']) {
      const script = packageJson.scripts?.[name] ?? ''
      expect(`${name}:clean`).toBe(`${name}:${script.startsWith('env -i ') ? 'clean' : 'inherited'}`)
      expect(script).toContain('bun --no-env-file scripts/bun-profile.ts')
    }
  })

  test('runner records versioned metadata and all required Bun 1.4 profile surfaces', async () => {
    const source = await readFile('scripts/bun-profile.ts', 'utf8')
    expect(source).toContain("'--cpu-prof-md'")
    expect(source).toContain("'--heap-prof-md'")
    expect(source).toContain('--metafile-md=')
    expect(source).toContain('bunVersion: Bun.version')
    expect(source).toContain("'runtime/profiling/bun-runtime'")
    expect(source).toContain("'test/test-runner.ts', '--price'")
    expect(source).toContain("'src/cli/create-cli.ts', '--help'")
  })

  test('bundle and heap inventories stay synthetic and cover runtime assets', async () => {
    const runner = await readFile('scripts/bun-profile.ts', 'utf8')
    const localWorkload = await readFile('scripts/profile-workloads/local-parsing-normalization.ts', 'utf8')
    const tokenizerWorkload = await readFile('scripts/profile-workloads/reference-tokenizer-memory.ts', 'utf8')
    expect(runner).toContain('dynamicImports')
    expect(runner).toContain('sourceLayoutReferences')
    expect(runner).toContain('referenceTokenizer')
    expect(localWorkload).toContain('synthetic-local-parsing-normalization-v1')
    expect(tokenizerWorkload).toContain('after-reconstruction')
    expect(tokenizerWorkload).toContain('rebuiltHash !== baselineHash')
  })
})
