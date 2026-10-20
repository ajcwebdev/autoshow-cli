/** One runner invocation whose observations were recorded. */
export type FileTimingsRun = {
  recordedAt: string
  /** Path filters; empty means every discovered test file was selected. */
  selection: string[]
  parallel: number | null
  maxConcurrency: number | null
  credentialMode: 'live' | 'fixture'
  sourceRevision: string | null
  exitCode: number
}

/**
 * The sum of passed test-body durations for one file in one run. It excludes imports, hooks and
 * failed cases, and concurrent tests can make it exceed elapsed time, so it is not Bun's native
 * elapsed file timing.
 */
export type FileTimingsSample = {
  runId: string
  passedBodyMs: number
  passed: number
  failed: number
}

export type TestTimingObservation = {
  runId: string
  durationMs: number
}

/** The latest passed and failed observations are kept apart, so a newer failure never hides behind an old success. */
export type TestTimingHistory = {
  passed?: TestTimingObservation
  failed?: TestTimingObservation
}

export type FileTimingsCacheFile = {
  version: number
  runs: Record<string, FileTimingsRun>
  files: Record<string, FileTimingsSample[]>
  tests: Record<string, TestTimingHistory>
}

export type FileTimingsRunContext = FileTimingsRun & {
  runId: string
  /** The complete discovered test-file inventory; cached entries for other files are pruned. */
  discoveredFiles: readonly string[]
  /** A test-name filter means a file's results are not its complete test inventory. */
  nameFiltered: boolean
}

export type FileTimingsLookup = {
  /** Median passed-body sum per file, from the custom aggregate rather than Bun's elapsed timings. */
  fileP50: Map<string, number>
  /** Latest passed duration per test. */
  testDurations: Map<string, number>
  /** Latest failed duration per test, kept separately from successes. */
  failedTestDurations: Map<string, number>
}
