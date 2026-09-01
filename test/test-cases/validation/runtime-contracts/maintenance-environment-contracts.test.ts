import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const temporaryRoots: string[] = []

const makeTemporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-no-env-file-'))
  temporaryRoots.push(root)
  return root
}

const runProbe = async (cwd: string, noEnvFile: boolean): Promise<Record<string, string | null>> => {
  const args = [
    process.execPath,
    ...(noEnvFile ? ['--no-env-file'] : []),
    '-e',
    'process.stdout.write(JSON.stringify({ fromFile: process.env.AUTOSHOW_NO_ENV_FILE_PROBE ?? null, exported: process.env.AUTOSHOW_EXPORTED_PROBE ?? null }))'
  ]
  const proc = Bun.spawn(args, {
    cwd,
    env: {
      PATH: process.env['PATH'] ?? '',
      AUTOSHOW_EXPORTED_PROBE: 'preserved'
    },
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  if (exitCode !== 0) throw new Error(stderr || `Environment probe exited ${exitCode}`)
  return JSON.parse(stdout) as Record<string, string | null>
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('maintenance environment contracts', () => {
  test('--no-env-file suppresses project files while retaining explicitly exported variables', async () => {
    const root = await makeTemporaryRoot()
    await writeFile(join(root, '.env'), 'AUTOSHOW_NO_ENV_FILE_PROBE=loaded-from-project-file\n')

    expect(await runProbe(root, false)).toEqual({ fromFile: 'loaded-from-project-file', exported: 'preserved' })
    expect(await runProbe(root, true)).toEqual({ fromFile: null, exported: 'preserved' })
  })

  test('maintenance scripts use isolated environments, parallel checks, and the installed compiler', async () => {
    const packageJson = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    const scripts = packageJson.scripts ?? {}

    expect(scripts['check']).toBe('bun run --parallel check:names check:types')
    expect(scripts['check:names']).toContain('env -i PATH="$PATH" HOME="$HOME" bun --no-env-file')
    expect(scripts['check:types']).toContain('bun --no-env-file node_modules/typescript/bin/tsc --noEmit')
    expect(scripts['check:types']).not.toContain('bunx')
    for (const name of ['repo', 'audit:ocr-tokens', 'analyze:complexity', 'baseline:docker', 'compare:env', 't']) {
      expect(scripts[name]).toStartWith('env -i PATH="$PATH" HOME="$HOME" bun --no-env-file')
    }
    expect(scripts['t:provider']).toBe('bun --no-env-file test/test-runner.ts')
  })

  test('the container disables implicit env files and documents explicit credential injection', async () => {
    const [dockerfile, docs, dockerAdr, environmentAdr] = await Promise.all([
      readFile(join(repositoryRoot, 'Dockerfile'), 'utf8'),
      readFile(join(repositoryRoot, 'docs/docker.md'), 'utf8'),
      readFile(join(repositoryRoot, 'docs/adr/ADR-014-distribute-the-cli-as-a-docker-image.md'), 'utf8'),
      readFile(join(repositoryRoot, 'docs/adr/ADR-005-reduce-environment-variable-surface-area.md'), 'utf8')
    ])

    expect(dockerfile).toContain('RUN bun --no-env-file install --frozen-lockfile --production')
    expect(dockerfile).toContain('ENTRYPOINT ["bun", "--no-env-file", "/app/src/cli/create-cli.ts"]')
    expect(docs).toContain("entrypoint intentionally disables Bun's automatic `.env` loading")
    expect(docs).toContain("Docker's `--env-file` option")
    expect(docs).toContain('Already-exported container environment variables remain supported')
    expect(docs).not.toContain('mount it at `/app/.env`')
    expect(dockerAdr).toContain('mounting a file at `/app/.env` is not a supported credential path')
    expect(environmentAdr).toContain('mounted `/app/.env` files are intentionally not loaded')
  })
})
