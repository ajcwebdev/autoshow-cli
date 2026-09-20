import { afterEach, describe, expect, test } from 'bun:test'
import { readFile, rm } from 'node:fs/promises'
import { closeArtifactLogs, createRunArtifacts } from '../../../../test-runner/artifacts'
import { forwardSpawnOutput } from '../../../../test-runner/process-execution'
import { createTerminalFilter, formatProgressLine } from '../../../../test-runner/terminal-filter'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

const run = (lines: string[], verbose = false): string[] => {
  const filter = createTerminalFilter({ verbose })
  return lines.flatMap(line => filter.push(`${line}\n`)).map(line => line.replace(/\n$/, ''))
}

describe('test-runner terminal filter', () => {
  test('drops pass and skip result lines and headers that only precede them', () => {
    expect(run([
      'bun test v1.4.2 (744846f84) 11× PARALLEL',
      '',
      'test/test-cases/validation/a.test.ts:',
      '✓ passes [1.00ms]',
      '» skipped live test',
      '(pass) plain-mode pass',
      '(skip) plain-mode skip',
    ])).toEqual(['bun test v1.4.2 (744846f84) 11× PARALLEL'])
  })

  test('prints a file header only before a failure or leaked output in that file', () => {
    expect(run([
      '',
      'test/test-cases/validation/a.test.ts:',
      '✓ first [1.00ms]',
      'error: expect(received).toBe(expected)',
      '',
      'Expected: 1',
      '✗ second [2.00ms]',
      '',
      'test/test-cases/validation/b.test.ts:',
      '✓ unrelated [1.00ms]',
      '',
      'test/test-cases/validation/a.test.ts:',
      '✗ third [3.00ms]',
    ])).toEqual([
      '',
      'test/test-cases/validation/a.test.ts:',
      'error: expect(received).toBe(expected)',
      '',
      'Expected: 1',
      '✗ second [2.00ms]',
      '',
      'test/test-cases/validation/a.test.ts:',
      '✗ third [3.00ms]',
    ])
  })

  test('drops the end-of-run skipped list but keeps the failed list and totals', () => {
    expect(run([
      '',
      '2 tests skipped:',
      '» live one',
      '» live two',
      '',
      '1 tests failed:',
      '✗ broken [1.00ms]',
      '',
      ' 10 pass',
      ' 2 skip',
      ' 1 fail',
      'Ran 13 tests across 2 files. [1.00s]',
    ])).toEqual([
      '',
      '1 tests failed:',
      '✗ broken [1.00ms]',
      '',
      ' 10 pass',
      ' 2 skip',
      ' 1 fail',
      'Ran 13 tests across 2 files. [1.00s]',
    ])
  })

  test('matches ANSI-colored Bun output', () => {
    expect(run([
      '\u001b[2mtest/test-cases/validation/a.test.ts:\u001b[0m',
      '\u001b[32m✓\u001b[0m colored pass \u001b[2m[1.00ms]\u001b[0m',
      '\u001b[31m✗\u001b[0m colored fail',
    ])).toEqual([
      '\u001b[2mtest/test-cases/validation/a.test.ts:\u001b[0m',
      '\u001b[31m✗\u001b[0m colored fail',
    ])
  })

  test('verbose mode prints every line unchanged', () => {
    const lines = ['', 'test/test-cases/validation/a.test.ts:', '✓ passes', '» skipped', '2 tests skipped:']
    expect(run(lines, true)).toEqual(lines)
  })

  test('counts results before the summary lists and formats the heartbeat', () => {
    const filter = createTerminalFilter()
    for (const line of ['✓ a', '✓ b', '✗ c', '» d', '', '1 tests failed:', '✗ c', '1 tests skipped:', '» d']) filter.push(`${line}\n`)
    expect(filter.counts()).toEqual({ passed: 2, failed: 1, skipped: 1 })
    expect(formatProgressLine(filter.counts(), 41_400)).toBe('progress: 2 passed · 1 failed · 1 skipped · 41s')
  })

  test('filtered lines still reach runner.log in full', async () => {
    const dir = await makeTempDir('autoshow-terminal-filter-')
    tempDirs.push(dir)
    const artifacts = await createRunArtifacts(dir)
    const stream = new Response('\ntest/test-cases/validation/a.test.ts:\n✓ quiet pass [1.00ms]\n» quiet skip\n').body
    if (!stream) throw new Error('missing fixture stream')
    const filter = createTerminalFilter()
    await forwardSpawnOutput(stream, 'STDERR', artifacts, undefined, filter)
    await closeArtifactLogs(artifacts)
    const runnerLog = await readFile(artifacts.runnerLogPath, 'utf8')
    expect(runnerLog).toContain('[STDERR] test/test-cases/validation/a.test.ts:')
    expect(runnerLog).toContain('[STDERR] ✓ quiet pass [1.00ms]')
    expect(runnerLog).toContain('[STDERR] » quiet skip')
    expect(filter.counts()).toEqual({ passed: 1, failed: 0, skipped: 1 })
  })
})
