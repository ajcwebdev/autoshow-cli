import { describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { childEnv, DEFAULT_CHILD_ENV_KEYS, MANAGED_CHILD_PATH } from '~/utils/child-env'
import { RUNTIME_CACHE_DIR, RUNTIME_TEMP_DIR } from '~/utils/runtime-state'
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
  test('managed defaults exclude external tools and temporary locations while explicit settings take precedence', () => {
    const source = {
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      TMPDIR: '/tmp/private-tmpdir',
      TMP: '/tmp/private-tmp',
      TEMP: '/tmp/private-temp'
    }

    const env = childEnv({ source })
    expect(env['PATH']).toBe(MANAGED_CHILD_PATH)
    expect(env['HOME']).toBe(source.HOME)
    expect(env['TMPDIR']).toBe(RUNTIME_TEMP_DIR)
    expect(env['TMP']).toBe(RUNTIME_TEMP_DIR)
    expect(env['TEMP']).toBe(RUNTIME_TEMP_DIR)
    expect(env['XDG_CACHE_HOME']).toBe(RUNTIME_CACHE_DIR)
    const privateTemporaryDirectory = join(RUNTIME_TEMP_DIR, 'child-env-private')
    expect(childEnv({ source, set: { TMPDIR: privateTemporaryDirectory } })['TMPDIR']).toBe(privateTemporaryDirectory)
    expect(childEnv({ source, set: { TMPDIR: undefined } })).not.toHaveProperty('TMPDIR')
  })

  test('a spawned child resolves its private runtime temp directory, explicit overrides, and platform fallback after explicit removal', async () => {
    expect(tmpdir()).toStartWith(`${RUNTIME_TEMP_DIR}/`)
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

    expect(env).toMatchObject({
      PATH: MANAGED_CHILD_PATH,
      TESSDATA_PREFIX: '/tmp/tessdata',
      FORCE_COLOR: '1'
    })
    expect(env).not.toHaveProperty('HOME')
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
