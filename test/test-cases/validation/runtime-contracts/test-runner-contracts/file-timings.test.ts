import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { buildFileTimingsRunContext, medianDuration, readBunFileTimings, readFileTimings, readFileTimingsCache, recordFileTimings } from '../../../../test-runner/file-timings'
import { readHistoricalLookups } from '../../../../test-runner/reports/history'
import { isLongRunningTestFile } from '../../../../test-utils/timeouts'
import type { FileTimingsRunContext, ParsedJunitCase, TestRunArtifacts } from '~/types'
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

const FILE = 'test/test-cases/e2e/service/example.test.ts'
const OTHER_FILE = 'test/test-cases/validation/other.test.ts'

const runContext = (runId: string, overrides: Partial<FileTimingsRunContext> = {}): FileTimingsRunContext => ({
  runId,
  recordedAt: '2026-10-17T00:00:00.000Z',
  selection: [],
  parallel: 11,
  maxConcurrency: 11,
  credentialMode: 'fixture',
  sourceRevision: '0afa2cbf1b85d3b42b6ced71fffa0316fb1c1592',
  exitCode: 0,
  discoveredFiles: [FILE, OTHER_FILE],
  nameFiltered: false,
  ...overrides,
})

const cachePathIn = async (prefix: string): Promise<string> => {
  const dir = await makeTempDir(prefix)
  tempDirs.push(dir)
  return join(dir, 'file-timings.json')
}

describe('test-runner file timings', () => {
  test('medianDuration uses the middle value or the mean of the two middles', () => {
    expect(medianDuration([])).toBeNull()
    expect(medianDuration([10])).toBe(10)
    expect(medianDuration([10, 30, 20])).toBe(20)
    expect(medianDuration([10, 40, 20, 30])).toBe(25)
  })

  test('passed and failed observations are kept apart, with run context for every sample', async () => {
    const cachePath = await cachePathIn('autoshow-file-timings-')
    await recordFileTimings([makeCase(FILE, 'slow', 80), makeCase(FILE, 'fast', 20), makeCase(FILE, 'flaky', 5, 'failed')], runContext('run-1', { exitCode: 1 }), cachePath)
    await recordFileTimings([makeCase(FILE, 'slow', 100), makeCase(FILE, 'fast', 40), makeCase(FILE, 'flaky', 30)], runContext('run-2', { credentialMode: 'live' }), cachePath)

    const timings = await readFileTimings(cachePath)
    expect(timings.testDurations.get(`${FILE}::slow`)).toBe(100)
    expect(timings.testDurations.get(`${FILE}::flaky`)).toBe(30)
    expect(timings.failedTestDurations.get(`${FILE}::flaky`)).toBe(5)
    // Medians of the passed-body sums 80+20 and 100+40+30; failed bodies are never added.
    expect(timings.fileP50.get(FILE)).toBe(135)

    const cache = await readFileTimingsCache(cachePath)
    expect(cache.files[FILE]).toEqual([
      { runId: 'run-1', passedBodyMs: 100, passed: 2, failed: 1 },
      { runId: 'run-2', passedBodyMs: 170, passed: 3, failed: 0 },
    ])
    expect(cache.runs['run-1']).toMatchObject({ exitCode: 1, credentialMode: 'fixture', parallel: 11, maxConcurrency: 11, selection: [] })
    expect(cache.runs['run-2']).toMatchObject({ exitCode: 0, credentialMode: 'live', sourceRevision: '0afa2cbf1b85d3b42b6ced71fffa0316fb1c1592' })
  })

  test('a newer failure is recorded without hiding behind or erasing the last success', async () => {
    const cachePath = await cachePathIn('autoshow-file-timings-failure-')
    await recordFileTimings([makeCase(FILE, 'slow', 100)], runContext('run-1'), cachePath)
    await recordFileTimings([makeCase(FILE, 'slow', 7, 'failed')], runContext('run-2', { exitCode: 1 }), cachePath)

    const cache = await readFileTimingsCache(cachePath)
    expect(cache.tests[`${FILE}::slow`]).toEqual({ passed: { runId: 'run-1', durationMs: 100 }, failed: { runId: 'run-2', durationMs: 7 } })
  })

  test('entries are pruned only against complete inventories', async () => {
    const cachePath = await cachePathIn('autoshow-file-timings-prune-')
    await recordFileTimings([makeCase(FILE, 'kept', 10), makeCase(FILE, 'renamed', 10), makeCase(OTHER_FILE, 'deleted-file', 10)], runContext('run-1'), cachePath)

    // A name-filtered run is not the file's complete inventory, so the unseen test stays.
    await recordFileTimings([makeCase(FILE, 'kept', 11)], runContext('run-2', { nameFiltered: true }), cachePath)
    expect((await readFileTimingsCache(cachePath)).tests[`${FILE}::renamed`]).toBeDefined()

    // A run with a failure in the file may have stopped early, so the unseen test stays too.
    await recordFileTimings([makeCase(FILE, 'kept', 12, 'failed')], runContext('run-3', { exitCode: 1 }), cachePath)
    expect((await readFileTimingsCache(cachePath)).tests[`${FILE}::renamed`]).toBeDefined()

    // A complete, passing run of the file retires the vanished test; a file no longer discovered is dropped.
    await recordFileTimings([makeCase(FILE, 'kept', 13)], runContext('run-4', { discoveredFiles: [FILE] }), cachePath)
    const cache = await readFileTimingsCache(cachePath)
    expect(Object.keys(cache.tests).sort()).toEqual([`${FILE}::kept`])
    expect(Object.keys(cache.files)).toEqual([FILE])
    expect(Object.keys(cache.runs).sort()).toEqual(['run-1', 'run-2', 'run-3', 'run-4'])
  })

  test('run records no observation still references are removed', async () => {
    const cachePath = await cachePathIn('autoshow-file-timings-runs-')
    await recordFileTimings([makeCase(OTHER_FILE, 'only', 10)], runContext('run-1'), cachePath)
    await recordFileTimings([makeCase(FILE, 'next', 10)], runContext('run-2', { discoveredFiles: [FILE] }), cachePath)

    expect(Object.keys((await readFileTimingsCache(cachePath)).runs)).toEqual(['run-2'])
  })

  test('a version 1 cache without run context is discarded rather than misread', async () => {
    const cachePath = await cachePathIn('autoshow-file-timings-v1-')
    await Bun.write(cachePath, JSON.stringify({ version: 1, files: { [FILE]: [120] }, tests: { [`${FILE}::slow`]: 100 } }))

    const timings = await readFileTimings(cachePath)
    expect(timings.fileP50.size).toBe(0)
    expect(timings.testDurations.size).toBe(0)
  })

  test('historical duration lookups read the latest passed duration', async () => {
    const cachePath = await cachePathIn('autoshow-file-timings-history-')
    await recordFileTimings([makeCase(FILE, 'slow', 42)], runContext('run-1'), cachePath)

    const historical = await readHistoricalLookups(fakeArtifacts(join(cachePath, '..')), cachePath)
    expect(historical.durationById.get(`${FILE}::slow`)).toBe(42)
  })

  test('the Bun native elapsed cache stays independent of the passed-body aggregate', async () => {
    const cachePath = await cachePathIn('autoshow-native-file-timings-')
    const nativePath = join(cachePath, '..', 'bun-file-timings.json')
    await recordFileTimings([makeCase(FILE, 'one', 80)], runContext('run-1'), cachePath)
    expect(await readBunFileTimings(nativePath)).toBeNull()

    // The shape Bun itself writes for --timings/--update-timings.
    await Bun.write(nativePath, JSON.stringify({ version: 1, files: { [FILE]: 912 } }))
    await recordFileTimings([makeCase(FILE, 'one', 120)], runContext('run-2'), cachePath)
    expect(await readBunFileTimings(nativePath)).toEqual({ version: 1, files: { [FILE]: 912 } })
  })

  test('run context reads worker limits and name filters from the effective Bun flags', () => {
    const base = { runId: 'run-1', recordedAt: '2026-10-17T00:00:00.000Z', selection: ['test/test-cases/validation'], credentialMode: 'fixture' as const, exitCode: 0, discoveredFiles: [FILE], sourceRevision: null }
    expect(buildFileTimingsRunContext({ ...base, bunFlags: ['--timeout', '600000', '--parallel=4', '--max-concurrency', '11'] })).toMatchObject({ parallel: 4, maxConcurrency: 11, nameFiltered: false, sourceRevision: null })
    expect(buildFileTimingsRunContext({ ...base, bunFlags: ['-t', 'slow'] }).nameFiltered).toBe(true)
    expect(buildFileTimingsRunContext({ ...base, bunFlags: ['--test-name-pattern=slow'] })).toMatchObject({ nameFiltered: true, parallel: null })
  })

  test('long-running timeout classification covers whisper-local and video files', () => {
    expect(isLongRunningTestFile('test/test-cases/e2e/local/stt/whisperfile/whisperfile-default.test.ts')).toBe(true)
    expect(isLongRunningTestFile('test/test-cases/e2e/local/stt/whisperfile/whisperfile-default.test.ts')).toBe(true)
    expect(isLongRunningTestFile('test/test-cases/e2e/service/visuals/video/fal-video.test.ts')).toBe(true)
    expect(isLongRunningTestFile('test/test-cases/e2e/local/audio/music/music-lyrics-video.test.ts')).toBe(true)
    expect(isLongRunningTestFile('test/test-cases/validation/stt/workflows/transcript-video/transcript-video-contracts.test.ts')).toBe(true)
    expect(isLongRunningTestFile('test/test-cases/e2e/service/visuals/image/fal-image.test.ts')).toBe(false)
    expect(isLongRunningTestFile('test/test-cases/e2e/service/audio/music/gemini-lyria-3.5.test.ts')).toBe(false)
    expect(isLongRunningTestFile('test/test-cases/e2e/service/stt/diarization/deepgram-nova-3.test.ts')).toBe(false)
    expect(isLongRunningTestFile('test/test-cases/validation/cli/cli-help-contracts.test.ts')).toBe(false)
  })
})
