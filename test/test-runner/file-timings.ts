import { readUtf8FileExact, writeFileExact } from '~/utils/bun-file-io'
import { PROJECT_ROOT } from '~/utils/project-root'
import { runSyncCommand } from '~/utils/sync-subprocess'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { FileTimingsCacheFile, FileTimingsLookup, FileTimingsRun, FileTimingsRunContext, FileTimingsSample, ParsedJunitCase, TestTimingHistory, TestTimingObservation } from '~/types'
import { TEST_OUTPUT_ROOT } from './artifacts'

// Version 2 records run context with every observation; older caches carry no context and are discarded.
const CACHE_VERSION = 2
const MAX_SAMPLES = 20

const FILE_TIMINGS_CACHE_PATH = join(TEST_OUTPUT_ROOT, '.test-cache', 'file-timings.json')
// Bun writes this native elapsed-time cache itself through --timings/--update-timings.
export const BUN_FILE_TIMINGS_CACHE_PATH = join(TEST_OUTPUT_ROOT, '.test-cache', 'bun-file-timings.json')

type BunFileTimingsCacheFile = {
  version: 1
  files: Record<string, number>
}

export const medianDuration = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null
  }
  const left = sorted[middle - 1]
  const right = sorted[middle]
  if (left === undefined || right === undefined) {
    return null
  }
  return (left + right) / 2
}

const emptyCache = (): FileTimingsCacheFile => ({ version: CACHE_VERSION, runs: {}, files: {}, tests: {} })

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isDuration = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const nullableNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null

const parseRun = (value: unknown): FileTimingsRun | undefined => {
  if (!isRecord(value) || typeof value['recordedAt'] !== 'string' || !Array.isArray(value['selection'])) return undefined
  return {
    recordedAt: value['recordedAt'],
    selection: value['selection'].filter((item): item is string => typeof item === 'string'),
    parallel: nullableNumber(value['parallel']),
    maxConcurrency: nullableNumber(value['maxConcurrency']),
    credentialMode: value['credentialMode'] === 'live' ? 'live' : 'fixture',
    sourceRevision: typeof value['sourceRevision'] === 'string' ? value['sourceRevision'] : null,
    exitCode: nullableNumber(value['exitCode']) ?? 0,
  }
}

const parseSample = (value: unknown): FileTimingsSample[] => {
  if (!isRecord(value) || typeof value['runId'] !== 'string' || !isDuration(value['passedBodyMs']) || !isDuration(value['passed']) || !isDuration(value['failed'])) return []
  return [{ runId: value['runId'], passedBodyMs: value['passedBodyMs'], passed: value['passed'], failed: value['failed'] }]
}

const parseObservation = (value: unknown): TestTimingObservation | undefined =>
  isRecord(value) && typeof value['runId'] === 'string' && isDuration(value['durationMs'])
    ? { runId: value['runId'], durationMs: value['durationMs'] }
    : undefined

const parseHistory = (value: unknown): TestTimingHistory | undefined => {
  if (!isRecord(value)) return undefined
  const passed = parseObservation(value['passed'])
  const failed = parseObservation(value['failed'])
  if (!passed && !failed) return undefined
  return { ...(passed ? { passed } : {}), ...(failed ? { failed } : {}) }
}

const parseCache = (raw: unknown): FileTimingsCacheFile => {
  if (!isRecord(raw) || raw['version'] !== CACHE_VERSION) return emptyCache()
  const section = (name: string): Record<string, unknown> => isRecord(raw[name]) ? raw[name] : {}
  return {
    version: CACHE_VERSION,
    runs: Object.fromEntries(Object.entries(section('runs')).flatMap(([id, run]) => {
      const parsed = parseRun(run)
      return parsed ? [[id, parsed]] : []
    })),
    files: Object.fromEntries(Object.entries(section('files')).flatMap(([file, samples]) => {
      const parsed = Array.isArray(samples) ? samples.flatMap(parseSample) : []
      return parsed.length > 0 ? [[file, parsed]] : []
    })),
    tests: Object.fromEntries(Object.entries(section('tests')).flatMap(([id, history]) => {
      const parsed = parseHistory(history)
      return parsed ? [[id, parsed]] : []
    })),
  }
}

export const readFileTimingsCache = async (cachePath = FILE_TIMINGS_CACHE_PATH): Promise<FileTimingsCacheFile> => {
  try {
    return parseCache(JSON.parse(await readUtf8FileExact(cachePath)) as unknown)
  } catch {
    return emptyCache()
  }
}

export const readFileTimings = async (cachePath = FILE_TIMINGS_CACHE_PATH): Promise<FileTimingsLookup> => {
  const cache = await readFileTimingsCache(cachePath)
  const fileP50 = new Map<string, number>()
  for (const [file, samples] of Object.entries(cache.files)) {
    const p50 = medianDuration(samples.filter(sample => sample.passed > 0).map(sample => sample.passedBodyMs))
    if (p50 !== null) {
      fileP50.set(file, p50)
    }
  }
  const latest = (status: keyof TestTimingHistory): Map<string, number> => new Map(Object.entries(cache.tests).flatMap(([id, history]) => {
    const observation = history[status]
    return observation ? [[id, observation.durationMs]] : []
  }))
  return {
    fileP50,
    testDurations: latest('passed'),
    failedTestDurations: latest('failed'),
  }
}

const parseBunFileTimings = (raw: unknown): BunFileTimingsCacheFile | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  if (record['version'] !== 1 || typeof record['files'] !== 'object' || record['files'] === null) return null
  const files = Object.fromEntries(Object.entries(record['files']).flatMap(([file, duration]) =>
    typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
      ? [[file, duration]]
      : []
  ))
  return { version: 1, files }
}

export const readBunFileTimings = async (
  cachePath = BUN_FILE_TIMINGS_CACHE_PATH
): Promise<BunFileTimingsCacheFile | null> => {
  try {
    return parseBunFileTimings(JSON.parse(await readUtf8FileExact(cachePath)) as unknown)
  } catch {
    return null
  }
}

const readNumericFlag = (flags: readonly string[], name: string): number | null => {
  for (const [index, flag] of flags.entries()) {
    const raw = flag === name ? flags[index + 1] : flag.startsWith(`${name}=`) ? flag.slice(name.length + 1) : undefined
    const value = raw === undefined ? Number.NaN : Number(raw)
    if (Number.isFinite(value)) return value
  }
  return null
}

const TEST_NAME_FILTER_FLAGS = ['-t', '--test-name-pattern']

const readSourceRevision = (): string | null => {
  const result = runSyncCommand('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT })
  const revision = result.stdout.trim()
  return result.success && /^[0-9a-f]{40}$/.test(revision) ? revision : null
}

/** Run context stored with every timing observation, read from the effective Bun test flags. */
export const buildFileTimingsRunContext = (input: {
  runId: string
  recordedAt: string
  selection: readonly string[]
  bunFlags: readonly string[]
  credentialMode: FileTimingsRun['credentialMode']
  exitCode: number
  discoveredFiles: readonly string[]
  sourceRevision?: string | null
}): FileTimingsRunContext => ({
  runId: input.runId,
  recordedAt: input.recordedAt,
  selection: [...input.selection],
  parallel: readNumericFlag(input.bunFlags, '--parallel'),
  maxConcurrency: readNumericFlag(input.bunFlags, '--max-concurrency'),
  credentialMode: input.credentialMode,
  sourceRevision: input.sourceRevision === undefined ? readSourceRevision() : input.sourceRevision,
  exitCode: input.exitCode,
  discoveredFiles: input.discoveredFiles,
  nameFiltered: input.bunFlags.some(flag => TEST_NAME_FILTER_FLAGS.some(name => flag === name || flag.startsWith(`${name}=`))),
})

const testFileOf = (id: string): string => id.slice(0, id.indexOf('::') === -1 ? id.length : id.indexOf('::'))

// Obsolete entries are pruned only against complete inventories: the discovered file list, and a
// file's results when it ran without a name filter and without failures (a bail can cut it short).
const pruneObsoleteEntries = (cache: FileTimingsCacheFile, cases: readonly ParsedJunitCase[], run: FileTimingsRunContext): void => {
  const discovered = new Set(run.discoveredFiles)
  for (const file of Object.keys(cache.files)) {
    if (!discovered.has(file)) delete cache.files[file]
  }
  const casesByFile = Map.groupBy(cases, testCase => testCase.file)
  const completeFiles = new Set(run.nameFiltered ? [] : [...casesByFile].filter(([, fileCases]) => fileCases.every(testCase => testCase.status !== 'failed')).map(([file]) => file))
  const currentIds = new Set(cases.map(testCase => testCase.id))
  for (const id of Object.keys(cache.tests)) {
    const file = testFileOf(id)
    if (!discovered.has(file) || (completeFiles.has(file) && !currentIds.has(id))) delete cache.tests[id]
  }
  const referencedRuns = new Set([
    ...Object.values(cache.files).flatMap(samples => samples.map(sample => sample.runId)),
    ...Object.values(cache.tests).flatMap(history => [history.passed?.runId, history.failed?.runId].filter((id): id is string => id !== undefined)),
  ])
  for (const runId of Object.keys(cache.runs)) {
    if (!referencedRuns.has(runId)) delete cache.runs[runId]
  }
}

export const recordFileTimings = async (
  junitCases: readonly ParsedJunitCase[],
  run: FileTimingsRunContext,
  cachePath = FILE_TIMINGS_CACHE_PATH
): Promise<void> => {
  const cache = await readFileTimingsCache(cachePath)
  const { runId, discoveredFiles: _discoveredFiles, nameFiltered: _nameFiltered, ...runRecord } = run
  cache.runs[runId] = runRecord
  const samplesByFile = new Map<string, FileTimingsSample>()

  for (const testCase of junitCases) {
    if (testCase.status === 'skipped') {
      continue
    }
    const sample = samplesByFile.get(testCase.file) ?? { runId, passedBodyMs: 0, passed: 0, failed: 0 }
    const history = cache.tests[testCase.id] ?? {}
    const observation = { runId, durationMs: testCase.durationMs }
    if (testCase.status === 'passed') {
      sample.passedBodyMs += testCase.durationMs
      sample.passed += 1
      history.passed = observation
    } else {
      sample.failed += 1
      history.failed = observation
    }
    cache.tests[testCase.id] = history
    samplesByFile.set(testCase.file, sample)
  }

  for (const [file, sample] of samplesByFile) {
    cache.files[file] = [...(cache.files[file] ?? []), sample].slice(-MAX_SAMPLES)
  }
  pruneObsoleteEntries(cache, junitCases, run)

  await mkdir(resolve(cachePath, '..'), { recursive: true })
  await writeFileExact(cachePath, `${JSON.stringify(cache, null, 2)}\n`)
}
