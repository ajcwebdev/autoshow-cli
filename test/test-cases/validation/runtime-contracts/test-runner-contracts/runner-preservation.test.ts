import { describe, expect, test } from 'bun:test'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { TestRunArtifacts } from '~/types'
import { closeArtifactLogs, createRunArtifacts, writeLatestRunLog, writeReportJson } from '../../../../test-runner/artifacts'
import { runTestRunner } from '../../../../test-runner/runner'
import { withTempDir } from '../../../../test-utils/temp-dirs'

const LOCAL_SELECTION = 'test/test-cases/validation/runtime-contracts/test-runner-contracts/runner-preservation.test.ts'
const MAPPED_SELECTION = 'test/test-cases/e2e/service/visuals/image/openai-gpt-image-2.test.ts'

const withOutputRoot = async (fn: (root: string) => Promise<void>): Promise<void> => {
  const keys = ['AUTOSHOW_TEST_CLI_BUNDLE', 'AUTOSHOW_PROJECT_ROOT']
  const previous = keys.map(key => process.env[key])
  try {
    await withTempDir('autoshow-price-preservation-', fn)
  } finally {
    keys.forEach((key, index) => {
      const value = previous[index]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    })
  }
}

const completedRun = async (root: string, exitCode = 0): Promise<TestRunArtifacts> => {
  const artifacts = await createRunArtifacts(root)
  await writeReportJson(artifacts, {
    run: { id: artifacts.runId, mode: 'test', endedAt: new Date().toISOString() },
    summary: { total: 1, passed: exitCode === 0 ? 1 : 0, failed: exitCode === 0 ? 0 : 1, skipped: 0 },
  })
  await writeLatestRunLog(artifacts, exitCode)
  await Bun.write(artifacts.activeRunPath, '{"pid":2147483647}')
  return artifacts
}

describe('price-only runner evidence preservation', () => {
  test('the price branch retains inactive and failed prior results and its own report without running tests', async () => {
    await withOutputRoot(async root => {
      const inactive = await completedRun(root)
      const failed = await completedRun(root, 1)
      const priorBytes = await Bun.file(inactive.reportJsonPath).text()
      const failedBytes = await Bun.file(failed.reportJsonPath).text()
      expect(await runTestRunner(['bun', 'runner', '--price', LOCAL_SELECTION], root)).toBe(0)
      expect(await Bun.file(inactive.reportJsonPath).text()).toBe(priorBytes)
      expect(await Bun.file(failed.reportJsonPath).text()).toBe(failedBytes)
      const newRun = (await readdir(root, { withFileTypes: true }))
        .find(entry => entry.isDirectory() && entry.name !== inactive.runId && entry.name !== failed.runId && !entry.name.startsWith('.'))
      expect(newRun).toBeDefined()
      const report = await Bun.file(join(root, newRun!.name, 'report.json')).json()
      expect(report.run.mode).toBe('price')
      expect(report.summary).toMatchObject({ total: 0, failed: 0, totalEstimatedCostCents: 0 })
      expect(await Bun.file(join(root, newRun!.name, 'junit.xml')).exists()).toBe(false)
    })
  }, 30_000)

  test('explicit cleanup removes owned successful artifacts while retaining failed, active, unknown, and TTS work', async () => {
    await withOutputRoot(async root => {
      const inactive = await completedRun(root)
      const failed = await completedRun(root, 1)
      const active = await createRunArtifacts(root)
      const tts = await completedRun(root)
      await mkdir(join(root, 'retained-report-evidence'))
      await Bun.write(join(root, 'retained-report-evidence', 'report.json'), '{}')
      await mkdir(join(tts.runDir, 'outputs', '.tts-tmp-openai-model'), { recursive: true })
      const audio = join(tts.runDir, 'outputs', '.tts-tmp-openai-model', 'segment.wav')
      await Bun.write(audio, 'previously purchased segment')
      try {
        expect(await runTestRunner(['bun', 'runner', '--price', '--cleanup', LOCAL_SELECTION], root)).toBe(0)
        expect(await Bun.file(inactive.reportJsonPath).exists()).toBe(false)
        expect(await Bun.file(failed.reportJsonPath).exists()).toBe(true)
        expect(await Bun.file(active.activeRunPath).exists()).toBe(true)
        expect(await Bun.file(audio).text()).toBe('previously purchased segment')
        expect((await readdir(root)).sort()).toEqual([
          '.test-cache', 'latest.log', failed.runId, active.runId, tts.runId, 'retained-report-evidence',
        ].sort())
        expect(await Bun.file(join(root, 'latest.log')).text()).toContain('Mode: price\nExit code: 0')
      } finally {
        await closeArtifactLogs(active)
      }
    })
  }, 30_000)

  test('a mapped provider selection executes only its local price command and retains the estimated-cost report', async () => {
    await withOutputRoot(async root => {
      expect(await runTestRunner(['bun', 'runner', '--price', MAPPED_SELECTION], root)).toBe(0)
      const run = (await readdir(root, { withFileTypes: true })).find(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      expect(run).toBeDefined()
      const report = await Bun.file(join(root, run!.name, 'report.json')).json()
      expect(report.run.mode).toBe('price')
      expect(report.summary).toMatchObject({ total: 1, passed: 1, failed: 0 })
      expect(report.summary.totalEstimatedCostCents).toBeGreaterThan(0)
      expect(report.commands[0].name).toBe('image-openai-gpt-image-2')
      expect(report.commands[0].args).toContain('--price')
      expect(await Bun.file(join(root, run!.name, 'junit.xml')).exists()).toBe(false)
    })
  }, 30_000)
})
