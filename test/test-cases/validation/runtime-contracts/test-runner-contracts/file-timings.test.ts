import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { medianDuration, readFileTimings, recordFileTimings } from '../../../../test-runner/file-timings'
import { readHistoricalLookups } from '../../../../test-runner/reports/history'
import { isLongRunningTestFile } from '../../../../test-utils/timeouts'
import type { ParsedJunitCase, TestRunArtifacts } from '~/types'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const makeCase = (
  file: string,
  name: string,
  durationMs: number,
  status: ParsedJunitCase['status'] = 'passed'
): ParsedJunitCase => ({
  id: `${file}::${name}`,
  file,
  name,
  line: 1,
  durationMs,
  status,
  failureMessage: null,
})

const fakeArtifacts = (rootDir: string): TestRunArtifacts => ({
  rootDir,
  runId: 'current-run',
  runDir: join(rootDir, 'current-run'),
  runnerLogPath: join(rootDir, 'current-run', 'runner.log'),
  commandLogPath: join(rootDir, 'current-run', 'commands.log'),
  metricsLogPath: join(rootDir, 'current-run', 'metrics.ndjson'),
  activeRunPath: join(rootDir, 'current-run', '.active-run.json'),
  junitPath: join(rootDir, 'current-run', 'junit.xml'),
  reportJsonPath: join(rootDir, 'current-run', 'report.json'),
  e2eReportJsonPath: join(rootDir, 'current-run', 'e2e-report.json'),
  calibrationReportJsonPath: join(rootDir, 'current-run', 'model-calibration.json'),
  metadataDirPath: join(rootDir, 'current-run', 'metadata'),
  startedAtMs: Date.now(),
  startedAtIso: new Date().toISOString(),
})

describe('test-runner file timings', () => {
  test('medianDuration uses the middle value or the mean of the two middles', () => {
    expect(medianDuration([])).toBeNull()
    expect(medianDuration([10])).toBe(10)
    expect(medianDuration([10, 30, 20])).toBe(20)
    expect(medianDuration([10, 40, 20, 30])).toBe(25)
  })

  test('recordFileTimings stores passed file p50 and per-test durations', async () => {
    const dir = await makeTempDir('autoshow-file-timings-')
    tempDirs.push(dir)
    const cachePath = join(dir, 'file-timings.json')
    const file = 'test/test-cases/e2e/service/example.test.ts'

    await recordFileTimings([
      makeCase(file, 'slow', 80),
      makeCase(file, 'fast', 20),
      makeCase(file, 'failed', 5, 'failed'),
    ], cachePath)
    await recordFileTimings([
      makeCase(file, 'slow', 100),
      makeCase(file, 'fast', 40),
    ], cachePath)

    const timings = await readFileTimings(cachePath)
    expect(timings.fileP50.get(file)).toBe(120)
    expect(timings.testDurations.get(`${file}::slow`)).toBe(100)
    expect(timings.testDurations.get(`${file}::fast`)).toBe(40)
    expect(timings.testDurations.has(`${file}::failed`)).toBe(false)
  })

  test('historical duration lookups read the surviving file-timings cache', async () => {
    const dir = await makeTempDir('autoshow-file-timings-history-')
    tempDirs.push(dir)
    const cachePath = join(dir, 'file-timings.json')
    const file = 'test/test-cases/e2e/service/example.test.ts'
    await recordFileTimings([makeCase(file, 'slow', 42)], cachePath)

    const historical = await readHistoricalLookups(fakeArtifacts(dir), cachePath)
    expect(historical.durationById.get(`${file}::slow`)).toBe(42)
  })

  test('long-running timeout classification covers whisper-local and video files', () => {
    expect(isLongRunningTestFile('test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/whisper-default.test.ts')).toBe(true)
    expect(isLongRunningTestFile('test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisperfile/whisperfile-default.test.ts')).toBe(true)
    expect(isLongRunningTestFile('test/test-cases/e2e/service/step-6-video-gen-e2e/fal-video.test.ts')).toBe(true)
    expect(isLongRunningTestFile('test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts')).toBe(true)
    expect(isLongRunningTestFile('test/test-cases/validation/media-generation/transcript-video-contracts.test.ts')).toBe(true)
    expect(isLongRunningTestFile('test/test-cases/e2e/service/step-5-image-gen-e2e/fal-image.test.ts')).toBe(false)
    expect(isLongRunningTestFile('test/test-cases/validation/cli/cli-help-contracts.test.ts')).toBe(false)
  })
})
