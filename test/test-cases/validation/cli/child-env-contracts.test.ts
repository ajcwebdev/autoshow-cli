import { describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { childEnv, DEFAULT_CHILD_ENV_KEYS } from '~/utils/child-env'
import { withTempDir } from '../../../test-utils/temp-dirs'

const spawnedChildTmpdir = async (env: Record<string, string>): Promise<string> => {
  const proc = Bun.spawn([
    process.execPath,
    '--no-env-file',
    '-e',
    'process.stdout.write(require("node:os").tmpdir())'
  ], { env, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  expect(exitCode).toBe(0)
  expect(stderr).toBe('')
  return stdout
}

describe('child process environment isolation', () => {
  test('temp-location variables pass through and follow set overrides and removals', () => {
    const source = {
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      TMPDIR: '/tmp/private-tmpdir',
      TMP: '/tmp/private-tmp',
      TEMP: '/tmp/private-temp'
    }

    expect(childEnv({ source })).toEqual(source)
    expect(childEnv({ source, set: { TMPDIR: '/tmp/override' } })['TMPDIR']).toBe('/tmp/override')
    expect(childEnv({ source, set: { TMPDIR: undefined } })).not.toHaveProperty('TMPDIR')
  })

  test('a spawned child resolves the parent temp directory by default, an override when set, and /tmp when removed', async () => {
    expect(await spawnedChildTmpdir(childEnv())).toBe(tmpdir())

    await withTempDir('autoshow-child-tmpdir-', async (overrideDir) => {
      expect(await spawnedChildTmpdir(childEnv({ set: { TMPDIR: overrideDir } }))).toBe(overrideDir)
    })

    expect(await spawnedChildTmpdir(childEnv({ set: { TMPDIR: undefined, TMP: undefined, TEMP: undefined } }))).toBe('/tmp')
  })

  test('the default allowlist contains no managed provider credentials', () => {
    const managed = new Set<string>(HOSTED_PROVIDER_ENV_CHECKS.map(check => check.envVar))
    for (const key of DEFAULT_CHILD_ENV_KEYS) expect(managed.has(key)).toBe(false)
  })

  test('ambient secrets are excluded while explicitly allowed and set values survive', () => {
    const env = childEnv({
      source: {
        PATH: '/usr/bin',
        HOME: '/tmp/home',
        OPENAI_API_KEY: 'sentinel-secret',
        TESSDATA_PREFIX: '/tmp/tessdata'
      },
      allow: ['TESSDATA_PREFIX'],
      set: { FORCE_COLOR: '1', HOME: undefined }
    })

    expect(env).toEqual({
      PATH: '/usr/bin',
      TESSDATA_PREFIX: '/tmp/tessdata',
      FORCE_COLOR: '1'
    })
    expect(env['OPENAI_API_KEY']).toBeUndefined()
  })

  test('a spawned child cannot observe an unrelated provider secret', async () => {
    const proc = Bun.spawn([
      process.execPath,
      '--no-env-file',
      '-e',
      'process.stdout.write(process.env.OPENAI_API_KEY ?? "missing")'
    ], {
      env: childEnv({
        source: {
          PATH: process.env['PATH'],
          HOME: process.env['HOME'],
          OPENAI_API_KEY: 'sentinel-secret'
        }
      }),
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ])

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')
    expect(stdout).toBe('missing')
  })
})
