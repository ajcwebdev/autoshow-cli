import type { BudgetPreflightSummary, HeadBudgetResult, PriceCommandResult, RunnerArgs, TestRunArtifacts } from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { serializeDiagnosticError } from '~/utils/error-handler'
import { parseRunnerArgs } from './args'
import {
  appendRunnerLog,
  cleanupRunArtifacts,
  cleanupTestOutputRoot,
  createRunArtifacts,
  writeJsonFile,
  writeLatestRunLog,
  writeReportJson
} from './artifacts'
import { prepareBudgetPreflight } from './budget-preflight-orchestration'
import { recordFileTimings } from './file-timings'
import { buildModelCalibrationReport } from './model-calibration'
import { readMetrics, parseJunit } from './parsers'
import { resolveSelectedFiles } from './path-selection'
import { resolvePriceSelection } from './price-commands/resolve'
import { buildEmptyBudgetSummary, runPriceSuite } from './price-execution'
import { prebuildTestCliBundle, runBunTest } from './process-execution'
import { buildPriceReportData } from './reports/price-report'
import { buildTestReportData } from './reports/test-report'
import { formatTimedOutputPrefix, lineHasTimedOutputPrefix, normalizeRepoPath } from './utils'

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

let timestampConsoleInstalled = false

export const installTimestampedConsole = (): void => {
  if (timestampConsoleInstalled) return
  timestampConsoleInstalled = true

  for (const method of ['log', 'warn', 'error'] as const) {
    const original = originalConsole[method]
    console[method] = ((...args: unknown[]) => {
      const prefix = formatTimedOutputPrefix(Date.now())
      if (args.length === 0) {
        original(prefix)
        return
      }
      if (typeof args[0] === 'string') {
        if (lineHasTimedOutputPrefix(args[0])) {
          original(...args)
          return
        }
        original(`${prefix} ${args[0]}`, ...args.slice(1))
        return
      }
      original(prefix, ...args)
    }) as typeof console[typeof method]
  }
}

const runStandardTestMode = async (
  args: RunnerArgs,
  allFiles: string[],
  artifacts: TestRunArtifacts,
  argv: string[],
  budgetHead: HeadBudgetResult
): Promise<number> => {
  const filesToRun = resolveSelectedFiles(allFiles, args.pathFilters)
  if (args.pathFilters.length === 0) {
    l.write('info', `Running all discovered tests (${filesToRun.length} files)`, { category: 'command' })
  } else {
    l.write('info', `Running selected tests (${filesToRun.length} files from ${args.pathFilters.length} path filter${args.pathFilters.length === 1 ? '' : 's'})`, { category: 'command' })
  }

  const budgetEnvOverrides: Record<string, string> = {}
  if (args.budgetHundredthCents !== undefined) {
    budgetEnvOverrides['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = JSON.stringify(budgetHead.skipKeys)
    budgetEnvOverrides['AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS'] = JSON.stringify(budgetHead.evaluatedKeys)
  }
  if (!args.adaptiveConcurrency) budgetEnvOverrides['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY'] = '0'

  const exitCode = await runBunTest(filesToRun, artifacts, args.passthroughArgs, args.preserveTestOutput, [], budgetEnvOverrides)
  const junitCases = await parseJunit(artifacts.junitPath)
  const metrics = await readMetrics(artifacts.metricsLogPath)
  const endedAtIso = new Date().toISOString()
  const endedAtMs = Date.now()
  const reportData = await buildTestReportData(junitCases, metrics, artifacts, endedAtIso, endedAtMs, argv.slice(2), budgetHead.summary)
  await recordFileTimings(junitCases)
  await writeReportJson(artifacts, reportData)
  if (typeof reportData['e2e'] === 'object' && reportData['e2e'] !== null) {
    await writeJsonFile(artifacts.e2eReportJsonPath, reportData['e2e'] as Record<string, unknown>)
  }
  const calibrationReport = await buildModelCalibrationReport(artifacts.rootDir)
  await writeJsonFile(artifacts.calibrationReportJsonPath, calibrationReport as unknown as Record<string, unknown>)
  l.write('info', `Model calibration report: ${normalizeRepoPath(artifacts.calibrationReportJsonPath)}`, { category: 'artifact' })
  if (calibrationReport.recommendedModels > 0) {
    l.write('info', `Model calibration recommendations found for ${calibrationReport.recommendedModels} model entr${calibrationReport.recommendedModels === 1 ? 'y' : 'ies'}`, { category: 'command' })
  }
  return exitCode
}

const runPriceMode = async (
  args: RunnerArgs,
  allFiles: string[],
  artifacts: TestRunArtifacts,
  argv: string[]
): Promise<number> => {
  const resolved = resolvePriceSelection(allFiles, args.pathFilters)
  let results: PriceCommandResult[] = []
  let budgetSummary: BudgetPreflightSummary | undefined
  let exitCode = 0

  if (resolved.commands.length === 0) {
    l.write('info', 'No pricing commands resolved for the selected paths; treating selection as a zero-cost price pass', { category: 'pricing' })
    budgetSummary = args.budgetHundredthCents !== undefined
      ? buildEmptyBudgetSummary(resolved.suiteName, args.budgetHundredthCents)
      : undefined
  } else {
    const suiteResult = await runPriceSuite(resolved.suiteName, resolved.commands, artifacts, args.budgetHundredthCents)
    results = suiteResult.results
    budgetSummary = suiteResult.budgetSummary
    exitCode = suiteResult.exitCode
  }

  const endedAtIso = new Date().toISOString()
  const endedAtMs = Date.now()
  const reportData = buildPriceReportData(results, resolved.suiteName, artifacts, endedAtIso, endedAtMs, argv.slice(2), budgetSummary)
  await writeReportJson(artifacts, reportData)
  return exitCode
}

const writeFallbackReport = async (
  args: RunnerArgs,
  artifacts: TestRunArtifacts,
  argv: string[],
  error: unknown
): Promise<void> => {
  const endedAtIso = new Date().toISOString()
  const endedAtMs = Date.now()
  await writeReportJson(artifacts, {
    run: {
      id: artifacts.runId,
      mode: args.priceMode ? 'price' : 'test',
      startedAt: artifacts.startedAtIso,
      endedAt: endedAtIso,
      durationMs: Math.max(0, endedAtMs - artifacts.startedAtMs),
      argv: argv.slice(2),
      artifactDir: normalizeRepoPath(artifacts.runDir),
      ...(args.budgetHundredthCents !== undefined
        ? {
            budgetHundredthCents: args.budgetHundredthCents,
            budgetPreflightSuite: 'unknown',
            budgetPreflightChecked: 0,
            budgetPreflightRunnable: 0,
            budgetPreflightSkipped: 0,
            budgetPreflightFailed: 0,
            budgetRunnableEstimatedCostCents: 0,
            budgetSkipKeys: [] as string[],
            budgetSkippedEntries: [] as { key: string, selectedCostCents: number }[],
          }
        : {}),
    },
    summary: { total: 0, passed: 0, failed: 1, skipped: 0 },
    error: error instanceof Error ? error.message : String(error),
    errorDiagnostics: serializeDiagnosticError(error)
  })
}

export const runTestRunner = async (argv: string[]): Promise<number> => {
  const args = parseRunnerArgs(argv)
  const glob = new Bun.Glob('test/test-cases/**/*.test.ts')
  const allFiles = (await Array.fromAsync(glob.scan({ dot: false }))).sort()
  const artifacts = await createRunArtifacts()
  installTimestampedConsole()
  l.write('info', `Test run artifacts: ${normalizeRepoPath(artifacts.runDir)}`, { category: 'artifact' })

  const [, , budgetHead] = await Promise.all([
    args.preserveTestOutput
      ? Promise.resolve()
      : cleanupTestOutputRoot(artifacts.rootDir, { keepRunDir: artifacts.runDir, preserveActiveRuns: true }),
    prebuildTestCliBundle(artifacts),
    prepareBudgetPreflight(args, allFiles, artifacts),
  ])
  appendRunnerLog(artifacts, `Run ID: ${artifacts.runId}\nStarted: ${artifacts.startedAtIso}\nArgs: ${argv.slice(2).join(' ')}\n`)

  let exitCode = 0
  try {
    exitCode = args.priceMode
      ? await runPriceMode(args, allFiles, artifacts, argv)
      : await runStandardTestMode(args, allFiles, artifacts, argv, budgetHead)
  } catch (error) {
    exitCode = 1
    await writeFallbackReport(args, artifacts, argv, error)
    l.error('Test run failed', { category: 'command', error })
  }

  const latestLogPath = await writeLatestRunLog(artifacts, exitCode)
  if (args.preserveTestOutput) {
    l.write('info', `Report JSON: ${normalizeRepoPath(artifacts.reportJsonPath)}`, { category: 'artifact' })
    if (!args.priceMode) {
      l.write('info', `E2E Report JSON: ${normalizeRepoPath(artifacts.e2eReportJsonPath)}`, { category: 'artifact' })
      l.write('info', `Model Calibration JSON: ${normalizeRepoPath(artifacts.calibrationReportJsonPath)}`, { category: 'artifact' })
    }
    l.write('info', `Latest log: ${normalizeRepoPath(latestLogPath)}`, { category: 'artifact' })
  } else {
    await cleanupRunArtifacts(artifacts)
    l.write('info', `Test output cleaned up; latest log: ${normalizeRepoPath(latestLogPath)}`, { category: 'artifact' })
  }
  return exitCode
}
