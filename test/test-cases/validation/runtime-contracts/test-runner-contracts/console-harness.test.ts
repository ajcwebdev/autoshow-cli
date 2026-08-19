import { describe, expect, test } from 'bun:test'
import { stripAnsi } from '~/utils/terminal-colors'

const fixturePath = './test/test-utils/fixtures/console-harness-sample.fixture.ts'

describe('test-runner contracts', () => {
  test('passing tests hide console output and failing tests keep their logs', async () => {
    const result = Bun.spawnSync(['bun', 'test', fixturePath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const output = stripAnsi(`${result.stdout.toString()}${result.stderr.toString()}`)

    expect(result.exitCode).toBe(1)
    expect(output).not.toContain('HARNESS_PASS_LOG')
    expect(output).toContain('HARNESS_FAIL_LOG')
    expect(output).toContain('failing noisy harness sample')
  })

  test('concurrent tests keep isolated console buffers', async () => {
    const result = Bun.spawnSync(['bun', 'test', './test/test-utils/fixtures/console-harness-concurrent.fixture.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const output = stripAnsi(`${result.stdout.toString()}${result.stderr.toString()}`)

    expect(result.exitCode).toBe(1)
    expect(output).not.toContain('HARNESS_CONCURRENT_PASS_LOG')
    expect(output).toContain('HARNESS_CONCURRENT_FAIL_LOG')
    expect(output).toContain('concurrent failing noisy harness sample')
  })
})
