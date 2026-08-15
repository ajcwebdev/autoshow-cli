import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleanupTestOutputRoot, createRunArtifacts, writeLatestRunLog } from '../../../../test-runner/artifacts'
import { parseJunit } from '../../../../test-runner/parsers'
import { lineHasTimedOutputPrefix, parseCommandEstimatedTotal } from '../../../../test-runner/utils'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('test-runner contracts', () => {
  test('timed output prefix detection skips already-timestamped lines', () => {
      expect(lineHasTimedOutputPrefix('[14:50:20.087] ✓ example')).toBe(true)
      expect(lineHasTimedOutputPrefix('[14:50:20] already stamped')).toBe(true)
      expect(lineHasTimedOutputPrefix('✓ example [8.25ms]')).toBe(false)
    })

  test('estimated-cost parser accepts readable totals and exact parenthetical cents', () => {
      expect(parseCommandEstimatedTotal('Total estimated cost: $3.59 (358.690¢)')).toBe(358.690)
      expect(parseCommandEstimatedTotal('Total estimated cost: free (0.000¢)')).toBe(0)
      expect(parseCommandEstimatedTotal('Suite total estimated cost: $3.59')).toBe(359)
      expect(parseCommandEstimatedTotal('Total estimated cost: 16.00¢')).toBe(16)
      expect(parseCommandEstimatedTotal('Total estimated cost: free')).toBe(0)
      expect(parseCommandEstimatedTotal('{"estimate":{"totalEstimatedCostCents":12.345}}')).toBe(12.345)
    })

  test('test-output cleanup preserves latest.log only', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'autoshow-test-output-cleanup-'))
      tempDirs.push(dir)

      await writeFile(join(dir, 'latest.log'), 'previous run\n')
      await mkdir(join(dir, 'stale-run'), { recursive: true })
      await writeFile(join(dir, 'stale-run', 'report.json'), '{}\n')
      await mkdir(join(dir, '.test-cache'), { recursive: true })
      await writeFile(join(dir, '.test-cache', 'cache.txt'), 'cache\n')

      await cleanupTestOutputRoot(dir)

      expect((await readdir(dir)).sort()).toEqual(['latest.log'])
      expect(await readFile(join(dir, 'latest.log'), 'utf8')).toBe('previous run\n')
    })

  test('test-output cleanup can preserve active runner artifacts', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'autoshow-test-output-active-cleanup-'))
      tempDirs.push(dir)

      const current = await createRunArtifacts(dir)
      const activeRun = join(dir, 'active-run')
      const staleRun = join(dir, 'stale-run')
      const cacheDir = join(dir, '.test-cache')

      await mkdir(activeRun, { recursive: true })
      await mkdir(staleRun, { recursive: true })
      await mkdir(cacheDir, { recursive: true })
      await writeFile(join(activeRun, '.active-run.json'), `${JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString(),
      })}\n`)
      await writeFile(join(staleRun, 'report.json'), '{}\n')
      await writeFile(join(cacheDir, 'cache.txt'), 'cache\n')

      await cleanupTestOutputRoot(dir, {
        keepRunDir: current.runDir,
        preserveActiveRuns: true,
      })

      expect((await readdir(dir)).sort()).toEqual([
        '.test-cache',
        'active-run',
        current.runId,
      ].sort())
    })

  test('latest log captures failure diagnostics before cleanup', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'autoshow-test-output-latest-log-'))
      tempDirs.push(dir)

      const artifacts = await createRunArtifacts(dir)
      await writeFile(artifacts.runnerLogPath, 'runner transcript\n')
      await writeFile(artifacts.commandLogPath, 'command transcript\n')
      await writeFile(artifacts.reportJsonPath, `${JSON.stringify({
        run: {
          id: artifacts.runId,
          mode: 'test',
          startedAt: artifacts.startedAtIso,
          endedAt: '2026-05-09T00:00:01.000Z',
          durationMs: 1000,
          argv: ['test/test-cases/example.test.ts']
        },
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
          skipped: 0
        },
        tests: [{
          file: 'test/test-cases/example.test.ts',
          name: 'fails usefully',
          status: 'failed',
          failureMessage: 'expected true'
        }]
      }, null, 2)}\n`)

      const latestLogPath = await writeLatestRunLog(artifacts, 1)
      await cleanupTestOutputRoot(dir)
      const latestLog = await readFile(latestLogPath, 'utf8')

      expect((await readdir(dir)).sort()).toEqual(['latest.log'])
      expect(latestLog).toContain(`Run ID: ${artifacts.runId}`)
      expect(latestLog).toContain('Exit code: 1')
      expect(latestLog).toContain('test/test-cases/example.test.ts :: fails usefully: expected true')
      expect(latestLog).toContain('runner transcript')
      expect(latestLog).toContain('command transcript')
    })

  test('JUnit XML parsing returns pass, fail, and skip counts', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-junit-'))
      tempDirs.push(dir)
      const junitPath = join(dir, 'junit.xml')
      await writeFile(junitPath, `<?xml version="1.0" encoding="UTF-8"?>
  <testsuites>
    <testsuite name="suite" file="test/test-cases/validation/runtime/example.test.ts">
      <testcase name="passes" file="test/test-cases/validation/runtime/example.test.ts" line="1" time="0.01" />
      <testcase name="fails" file="test/test-cases/validation/runtime/example.test.ts" line="2" time="0.02"><failure message="bad" /></testcase>
      <testcase name="skips" file="test/test-cases/validation/runtime/example.test.ts" line="3" time="0.03"><skipped /></testcase>
    </testsuite>
  </testsuites>`)

      const cases = await parseJunit(junitPath)
      expect(cases.map((entry) => entry.status)).toEqual(['passed', 'failed', 'skipped'])
      expect(cases.filter((entry) => entry.status === 'passed')).toHaveLength(1)
      expect(cases.filter((entry) => entry.status === 'failed')).toHaveLength(1)
      expect(cases.filter((entry) => entry.status === 'skipped')).toHaveLength(1)
    })
})
