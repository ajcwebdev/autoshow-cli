import { describe, expect, test } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stripAnsi } from '~/utils/terminal-colors'
import { withTempDir } from '../../../../test-utils/temp-dirs'

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

  test('parallel isolated files reinstall the preload and use independent scratch directories', async () => {
    await withTempDir('autoshow-console-harness-parallel-', async (artifactsDir) => {
      const result = Bun.spawnSync([
        'bun',
        'test',
        '--parallel=2',
        './test/test-utils/fixtures/console-harness-parallel-pass.fixture.ts',
        './test/test-utils/fixtures/console-harness-parallel-fail.fixture.ts',
      ], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          AUTOSHOW_TEST_ARTIFACTS_DIR: artifactsDir,
          FORCE_COLOR: '1',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const output = stripAnsi(`${result.stdout.toString()}${result.stderr.toString()}`)
      expect(result.exitCode).toBe(1)
      expect(output).not.toContain('HARNESS_PARALLEL_PASS_LOG')
      expect(output).toContain('HARNESS_PARALLEL_FAIL_LOG')
      expect(output).toContain('parallel failing harness sample')

      const outputRoot = join(artifactsDir, 'outputs')
      const scratchDirectories = (await readdir(outputRoot)).sort()
      expect(scratchDirectories).toHaveLength(2)
      expect(new Set(scratchDirectories).size).toBe(2)
      expect(scratchDirectories.every(directory => /^w[^/]+-p\d+$/.test(directory))).toBe(true)

      const markers = await Promise.all(scratchDirectories.map(async directory => {
        const files = await readdir(join(outputRoot, directory))
        const marker = files.find(file => file.startsWith('parallel-'))
        const [pid = '', workerId = ''] = marker
          ? (await readFile(join(outputRoot, directory, marker), 'utf8')).trim().split('\n')
          : []
        return {
          directory,
          marker,
          pid,
          workerId,
        }
      }))
      expect(markers.map(marker => marker.marker).sort()).toEqual(['parallel-fail.txt', 'parallel-pass.txt'])
      expect(markers.every(marker => marker.workerId.length > 0 && marker.directory === `w${marker.workerId}-p${marker.pid}`)).toBe(true)
    })
  })
})
