import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { FileTimingsCacheFile, FileTimingsLookup, ParsedJunitCase } from '~/types'

const CACHE_VERSION = 1
const MAX_SAMPLES = 20

const FILE_TIMINGS_CACHE_PATH = resolve(process.cwd(), 'project/test-output/.test-cache/file-timings.json')

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

const parseCache = (raw: unknown): FileTimingsCacheFile => {
  if (typeof raw !== 'object' || raw === null) {
    return { version: CACHE_VERSION, files: {}, tests: {} }
  }
  const record = raw as Record<string, unknown>
  if (record['version'] !== CACHE_VERSION) {
    return { version: CACHE_VERSION, files: {}, tests: {} }
  }
  const files = typeof record['files'] === 'object' && record['files'] !== null
    ? record['files'] as Record<string, unknown>
    : {}
  const tests = typeof record['tests'] === 'object' && record['tests'] !== null
    ? record['tests'] as Record<string, unknown>
    : {}
  return {
    version: CACHE_VERSION,
    files: Object.fromEntries(Object.entries(files).flatMap(([file, samples]) => {
      if (!Array.isArray(samples)) {
        return []
      }
      const durations = samples.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
      return durations.length > 0 ? [[file, durations]] : []
    })),
    tests: Object.fromEntries(Object.entries(tests).flatMap(([id, duration]) =>
      typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
        ? [[id, duration]]
        : []
    )),
  }
}

const readCacheFile = async (cachePath: string): Promise<FileTimingsCacheFile> => {
  try {
    return parseCache(JSON.parse(await readFile(cachePath, 'utf8')) as unknown)
  } catch {
    return { version: CACHE_VERSION, files: {}, tests: {} }
  }
}

export const readFileTimings = async (cachePath = FILE_TIMINGS_CACHE_PATH): Promise<FileTimingsLookup> => {
  const cache = await readCacheFile(cachePath)
  const fileP50 = new Map<string, number>()
  for (const [file, samples] of Object.entries(cache.files)) {
    const p50 = medianDuration(samples)
    if (p50 !== null) {
      fileP50.set(file, p50)
    }
  }
  return {
    fileP50,
    testDurations: new Map(Object.entries(cache.tests)),
  }
}

export const recordFileTimings = async (
  junitCases: readonly ParsedJunitCase[],
  cachePath = FILE_TIMINGS_CACHE_PATH
): Promise<void> => {
  const cache = await readCacheFile(cachePath)
  const passedByFile = new Map<string, number>()

  for (const testCase of junitCases) {
    if (testCase.status !== 'passed') {
      continue
    }
    passedByFile.set(testCase.file, (passedByFile.get(testCase.file) ?? 0) + testCase.durationMs)
    cache.tests[testCase.id] = testCase.durationMs
  }

  for (const [file, durationMs] of passedByFile) {
    const samples = cache.files[file] ?? []
    samples.push(durationMs)
    cache.files[file] = samples.slice(-MAX_SAMPLES)
  }

  await mkdir(resolve(cachePath, '..'), { recursive: true })
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`)
}
