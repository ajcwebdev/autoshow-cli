import { describe, expect, test } from 'bun:test'
import { HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { childEnv, DEFAULT_CHILD_ENV_KEYS } from '~/utils/child-env'

describe('child process environment isolation', () => {
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
