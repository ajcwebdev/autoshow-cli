import { appendFile } from 'node:fs/promises'
import type {
  BudgetPreflightResult,
  BudgetPreflightSummary,
  ExecutedPriceCommand,
  PriceCommandObservation,
  PriceCommandResult,
  PriceCommandSpec,
  RunnerArgs,
  RunnerStreamLabel,
  TestRunArtifacts
} from '~/types'
import { DEFAULT_TEST_RUNNER_CONCURRENCY, isE2EOnlyTestSelection, parseRunnerArgs, withDefaultTestConcurrency } from './args'
import {
  appendRunnerLog,
  appendCommandLog,
  cleanupRunArtifacts,
  cleanupTestOutputRoot,
  createRunArtifacts,
  writeJsonFile,
  writeLatestRunLog,
  writeReportJson
} from './artifacts'
import { readMetrics, parseJunit } from './parsers'
import {
  evaluatePriceObservationGroup,
  evaluatePriceObservations,
  groupCommandsByKey,
  toObservation,
} from './price-evaluation'
import { resolvePriceSelection } from './price-commands/resolve'
import { buildPriceReportData } from './reports/price-report'
import { buildTestReportData } from './reports/test-report'
import { formatTimedOutputPrefix, normalizeRepoPath, parseCommandEstimatedTotal } from './utils'
import { buildModelCalibrationReport } from './model-calibration'
import { resolveSelectedFiles } from './path-selection'
import { withEmptyPriceConfig } from './price-command-config'
import { E2E_TEST_TIMEOUT_MS } from '../test-utils/timeouts'
import { l } from '~/utils/app-logger/app-logger'
import { formatCost } from '~/utils/app-logger/formatters'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'

const budgetHundredthCentsToCents = (budgetHundredthCents: number): number => budgetHundredthCents / 100
const formatBudgetHundredthCents = (budgetHundredthCents: number): string => formatCost(budgetHundredthCentsToCents(budgetHundredthCents))

const PRICE_CONCURRENCY = DEFAULT_TEST_RUNNER_CONCURRENCY

const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await fn(items[index] as T, index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

const withPriceExecutionConfig = (entry: PriceCommandSpec): PriceCommandSpec => {
  const args = withEmptyPriceConfig(entry.args)
  return args === entry.args ? entry : { ...entry, args }
}

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

let timestampConsoleInstalled = false
let timestampConsoleStartedAtMs = 0

const installTimestampedConsole = (startedAtMs: number): void => {
  timestampConsoleStartedAtMs = startedAtMs
  if (timestampConsoleInstalled) {
    return
  }

  timestampConsoleInstalled = true

  for (const method of ['log', 'warn', 'error'] as const) {
    const original = originalConsole[method]
    console[method] = ((...args: unknown[]) => {
      const prefix = formatTimedOutputPrefix(Date.now(), timestampConsoleStartedAtMs)
      if (args.length === 0) {
        original(prefix)
        return
      }
      if (typeof args[0] === 'string') {
        original(`${prefix} ${args[0]}`, ...args.slice(1))
        return
      }
      original(prefix, ...args)
    }) as typeof console[typeof method]
  }
}

const writeCommandMetric = async (artifacts: TestRunArtifacts, record: Record<string, unknown>): Promise<void> => {
  try {
    await appendFile(artifacts.metricsLogPath, `${JSON.stringify(record)}\n`)
  } catch {
  }
}

const executePriceCommand = async (
  entry: PriceCommandSpec,
  artifacts: TestRunArtifacts,
  logLabel: string
): Promise<ExecutedPriceCommand> => {
  const start = Date.now()
  const priceOutputRoot = `${artifacts.runDir}/outputs/price`
  const cliArgs = [...entry.args, '--output-root', priceOutputRoot]
  const commandText = `bun --env-file=.env ${cliArgs.join(' ')}`
  const proc = Bun.spawn(['bun', '--env-file=.env', ...cliArgs], {
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])

  const durationMs = Date.now() - start
  const parsedCost = parseCommandEstimatedTotal(`${stdout}\n${stderr}`)

  await appendCommandLog(
    artifacts,
    `\n=== ${logLabel} ${entry.name} ===\ncmd: ${commandText}\nexit: ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}\n`
  )

  await writeCommandMetric(artifacts, {
    kind: 'command_metric',
    at: new Date().toISOString(),
    source: 'runCommand',
    command: commandText,
    args: entry.args,
    exitCode,
    durationMs,
    outputDir: null,
    callerFile: null,
    callerLine: null,
    callerColumn: null,
  })

  return {
    commandText,
    stdout,
    stderr,
    exitCode,
    durationMs,
    parsedCost,
  }
}

const buildEmptyBudgetSummary = (suiteName: string, budgetHundredthCents: number): BudgetPreflightSummary => {
  return {
    suiteName,
    budgetHundredthCents,
    commandsChecked: 0,
    commandsRunnable: 0,
    commandsSkipped: 0,
    commandsFailed: 0,
    runnableEstimatedCostCents: 0,
    skipKeys: [],
    skippedEntries: [],
  }
}

const logPriceCommandFailure = (executed: ExecutedPriceCommand, message: string): void => {
  l.error(message)

  const stdoutTail = executed.stdout.split('\n').slice(-20).join('\n')
  const stderrTail = executed.stderr.split('\n').slice(-20).join('\n')
  if (stdoutTail.trim().length > 0) {
    l.error(`  stdout tail:\n${stdoutTail}`)
  }
  if (stderrTail.trim().length > 0) {
    l.error(`  stderr tail:\n${stderrTail}`)
  }
}

const forwardSpawnOutput = async (
  stream: ReadableStream,
  label: RunnerStreamLabel,
  artifacts: TestRunArtifacts
): Promise<void> => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const writer = label === 'STDOUT' ? process.stdout : process.stderr
  let buffered = ''

  const flushLine = async (line: string): Promise<void> => {
    if (line.length === 0) {
      return
    }

    const prefix = formatTimedOutputPrefix(Date.now(), artifacts.startedAtMs)
    writer.write(`${prefix} ${line}`)
    await appendRunnerLog(artifacts, `${prefix} [${label}] ${line}`)
  }

  const flushBuffered = async (force: boolean): Promise<void> => {
    while (true) {
      const newlineIndex = buffered.indexOf('\n')
      if (newlineIndex === -1) {
        break
      }

      const line = buffered.slice(0, newlineIndex + 1)
      buffered = buffered.slice(newlineIndex + 1)
      await flushLine(line)
    }

    if (force && buffered.length > 0) {
      await flushLine(buffered)
      buffered = ''
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffered += decoder.decode(value, { stream: true })
      await flushBuffered(false)
    }

    const tail = decoder.decode()
    if (tail.length > 0) {
      buffered += tail
    }

    await flushBuffered(true)
  } finally {
    reader.releaseLock()
  }
}

const runBunTest = async (
  files: string[],
  artifacts: TestRunArtifacts,
  passthroughArgs: string[],
  preserveTestOutput: boolean,
  extraArgs: string[] = [],
  envOverrides: Record<string, string> = {}
): Promise<number> => {
  const args = [
    'test',
    '--timeout',
    String(E2E_TEST_TIMEOUT_MS),
    ...withDefaultTestConcurrency(passthroughArgs),
    '--reporter',
    'junit',
    '--reporter-outfile',
    artifacts.junitPath,
    ...extraArgs,
    ...files,
  ]

  await appendRunnerLog(artifacts, `\n=== START bun ${args.join(' ')} ===\n`)

  const childEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      childEnv[key] = value
    }
  }
  childEnv['FORCE_COLOR'] = '1'
  childEnv['AUTOSHOW_TEST_ARTIFACTS_DIR'] = artifacts.runDir
  childEnv['AUTOSHOW_TEST_COMMAND_LOG'] = artifacts.commandLogPath
  childEnv['AUTOSHOW_TEST_METRICS_LOG'] = artifacts.metricsLogPath
  childEnv['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] = preserveTestOutput ? '1' : '0'
  childEnv['AUTOSHOW_TEST_ADAPTIVE_E2E_SELECTION'] = isE2EOnlyTestSelection(files) ? '1' : '0'
  childEnv['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY'] = envOverrides['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY']
    ?? childEnv['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY']
    ?? '1'
  for (const [key, value] of Object.entries(envOverrides)) {
    childEnv[key] = value
  }

  const proc = Bun.spawn(['bun', ...args], {
    env: childEnv,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [exitCode] = await Promise.all([
    proc.exited,
    forwardSpawnOutput(proc.stdout, 'STDOUT', artifacts),
    forwardSpawnOutput(proc.stderr, 'STDERR', artifacts),
  ])

  await appendRunnerLog(artifacts, `\n=== END bun ${args.join(' ')} (exit=${exitCode}) ===\n`)
  return exitCode
}

const runPriceSuite = async (
  suiteName: string,
  commands: PriceCommandSpec[],
  artifacts: TestRunArtifacts,
  budgetHundredthCents?: number
): Promise<{ exitCode: number, results: PriceCommandResult[], budgetSummary: BudgetPreflightSummary | undefined }> => {
  const executionCommands = commands.map(withPriceExecutionConfig)

  if (executionCommands.length === 0) {
    l.write('info', `No ${suiteName} pricing commands resolved; treating selection as a zero-cost price pass`)
    return {
      exitCode: 0,
      results: [],
      budgetSummary: budgetHundredthCents !== undefined ? buildEmptyBudgetSummary(suiteName, budgetHundredthCents) : undefined,
    }
  }

  l.write('info', `Running ${suiteName} pricing preflight across ${executionCommands.length} command(s)`)
  if (budgetHundredthCents !== undefined) {
    l.write('info', `Budget filter (per test key): ${formatBudgetHundredthCents(budgetHundredthCents)}`)
  }

  const executedResults = await runWithConcurrency(executionCommands, PRICE_CONCURRENCY, async (entry, _index) => {
    const executed = await executePriceCommand(entry, artifacts, 'PRICE COMMAND')
    const observation = toObservation(entry, executed)
    return { entry, executed, observation }
  })

  const observations: PriceCommandObservation[] = []
  for (const [index, { entry, executed, observation }] of executedResults.entries()) {
    observations.push(observation)
    l.write('info', `[${index + 1}/${executionCommands.length}] ${entry.name}`)
    if (observation.failureMessage !== null) {
      logPriceCommandFailure(executed, `  FAIL exit=${executed.exitCode}`)
    } else {
      l.write('info', `  cost: ${formatCost(observation.costCents as number)}`)
    }
  }

  const evaluation = evaluatePriceObservations(suiteName, observations, budgetHundredthCents)
  const skippedCommands = evaluation.commandResults.filter(result => result.status === 'skipped').length

  const summaryRows: [string, string][] = [
    ['Commands checked', String(executionCommands.length)],
    ['Commands failed', String(evaluation.failedCommands)],
  ]
  if (evaluation.budgetSummary) {
    summaryRows.push(
      ['Test keys checked', String(evaluation.budgetSummary.commandsChecked)],
      ['Test keys runnable', String(evaluation.budgetSummary.commandsRunnable)],
      ['Test keys skipped', String(evaluation.budgetSummary.commandsSkipped)],
      ['Commands skipped (over-budget keys)', String(skippedCommands)],
      ['Price report included estimated cost', formatCost(evaluation.totalEstimatedCostCents)],
      ['Budget runnable estimate (max variant per key)', formatCost(evaluation.budgetSummary.runnableEstimatedCostCents)],
    )
  } else {
    summaryRows.push(['Suite total estimated cost', formatCost(evaluation.totalEstimatedCostCents)])
  }

  l.write('success', `${suiteName} Pricing Summary`, {
    category: 'pricing',
    humanTable: createKeyValueTable(summaryRows),
  })

  if (evaluation.budgetSummary && evaluation.budgetSummary.skipKeys.length > 0) {
    l.write('info', `Skipped test key list (${evaluation.budgetSummary.skipKeys.length})`, {
      category: 'pricing',
      humanTable: createKeyValueTable(
        evaluation.budgetSummary.skippedEntries.map(entry => [entry.key, formatCost(entry.selectedCostCents)] as [string, string])
      ),
    })
  }

  return {
    exitCode: evaluation.failedCommands > 0 ? 1 : 0,
    results: evaluation.commandResults,
    budgetSummary: evaluation.budgetSummary,
  }
}

const runBudgetPreflight = async (
  suiteName: string,
  commands: PriceCommandSpec[],
  budgetHundredthCents: number,
  artifacts: TestRunArtifacts
): Promise<BudgetPreflightResult> => {
  const executionCommands = commands.map(withPriceExecutionConfig)
  const groupedCommands = groupCommandsByKey(executionCommands)

  if (groupedCommands.length === 0) {
    return {
      summary: buildEmptyBudgetSummary(suiteName, budgetHundredthCents),
      skipKeys: [],
      evaluatedKeys: [],
    }
  }

  l.write('info', `Running ${suiteName} budget preflight across ${groupedCommands.length} test key(s) (${executionCommands.length} command variant(s))`)
  l.write('info', `Budget: ${formatBudgetHundredthCents(budgetHundredthCents)}`)

  // Execute all commands concurrently, preserving group/variant structure
  const allVariants = groupedCommands.flatMap((group, groupIndex) =>
    group.variants.map((entry, variantIndex) => ({ entry, groupIndex, variantIndex }))
  )

  const executedVariants = await runWithConcurrency(allVariants, PRICE_CONCURRENCY, async (item) => {
    const executed = await executePriceCommand(item.entry, artifacts, 'BUDGET PREFLIGHT COMMAND')
    const observation = toObservation(item.entry, executed)
    return { ...item, executed, observation }
  })

  // Rebuild per-group results and log in original order
  const groupResults = new Map<number, { executed: ExecutedPriceCommand, observation: PriceCommandObservation, variantIndex: number }[]>()
  for (const result of executedVariants) {
    let list = groupResults.get(result.groupIndex)
    if (!list) {
      list = []
      groupResults.set(result.groupIndex, list)
    }
    list.push(result)
  }

  const observations: PriceCommandObservation[] = []

  for (const [index, group] of groupedCommands.entries()) {
    l.write('info', `[${index + 1}/${groupedCommands.length}] ${group.key}`)

    const variants = groupResults.get(index) ?? []
    variants.sort((a, b) => a.variantIndex - b.variantIndex)

    const groupObservations: PriceCommandObservation[] = []
    for (const { executed, observation, variantIndex } of variants) {
      observations.push(observation)
      groupObservations.push(observation)

      if (observation.failureMessage !== null) {
        logPriceCommandFailure(
          executed,
          `  variant ${variantIndex + 1}/${group.variants.length}: FAIL exit=${executed.exitCode} (could not resolve numeric estimate)`
        )
        continue
      }

      const variantCost = observation.costCents as number
      if (group.variants.length > 1) {
        l.write('info', `  variant ${variantIndex + 1}/${group.variants.length}: ${formatCost(variantCost)}`)
      }
    }

    const groupEvaluation = evaluatePriceObservationGroup(group.key, groupObservations, budgetHundredthCents)
    if (groupEvaluation.variantCostsCents.length === 0 || groupEvaluation.selectedCostCents === null) {
      continue
    }

    if (groupEvaluation.variantCount > 1) {
      l.write('info', `  selected cost (max variant): ${formatCost(groupEvaluation.selectedCostCents)}`)
    }
    l.write('info', `  decision: ${groupEvaluation.overBudget ? 'SKIP (over budget)' : 'RUN'}`)
  }

  const evaluation = evaluatePriceObservations(suiteName, observations, budgetHundredthCents)
  const budgetSummary = evaluation.budgetSummary ?? buildEmptyBudgetSummary(suiteName, budgetHundredthCents)

  l.write('success', `${suiteName} Budget Preflight Summary`, {
    category: 'pricing',
    humanTable: createKeyValueTable([
      ['Test keys checked', String(budgetSummary.commandsChecked)],
      ['Command variants checked', String(executionCommands.length)],
      ['Commands runnable', String(budgetSummary.commandsRunnable)],
      ['Commands skipped', String(budgetSummary.commandsSkipped)],
      ['Commands failed', String(budgetSummary.commandsFailed)],
      ['Runnable estimated cost', formatCost(budgetSummary.runnableEstimatedCostCents)],
    ]),
  })

  if (budgetSummary.skipKeys.length > 0) {
    l.write('info', `Skipped command list (${budgetSummary.skipKeys.length})`, {
      category: 'pricing',
      humanTable: createKeyValueTable(
        budgetSummary.skippedEntries.map(entry => [entry.key, formatCost(entry.selectedCostCents)] as [string, string])
      ),
    })
  }

  if (budgetSummary.commandsFailed > 0) {
    throw new Error(`Budget preflight failed for ${budgetSummary.commandsFailed} command(s); cannot continue with --budget`)
  }

  return {
    summary: budgetSummary,
    skipKeys: budgetSummary.skipKeys,
    evaluatedKeys: groupedCommands.map(group => group.key),
  }
}

const runStandardTestMode = async (
  args: RunnerArgs,
  allFiles: string[],
  artifacts: TestRunArtifacts,
  argv: string[]
): Promise<number> => {
  const filesToRun = resolveSelectedFiles(allFiles, args.pathFilters)

  if (args.pathFilters.length === 0) {
    l.write('info', `Running all discovered tests (${filesToRun.length} files)`)
  } else {
    l.write('info', `Running selected tests (${filesToRun.length} files from ${args.pathFilters.length} path filter${args.pathFilters.length === 1 ? '' : 's'})`)
  }

  let budgetSummary: BudgetPreflightSummary | undefined
  let budgetSkipKeys: string[] = []
  let budgetEvaluatedKeys: string[] = []
  if (args.budgetHundredthCents !== undefined) {
    const resolved = resolvePriceSelection(allFiles, args.pathFilters, {
      mode: 'budget',
      budgetSkippableOnly: true
    })
    if (resolved.commands.length === 0) {
      l.write('info', 'No budget-skippable pricing commands resolved for --budget preflight; any selected budgeted tests will fail closed as unevaluated')
      budgetSummary = buildEmptyBudgetSummary(resolved.suiteName, args.budgetHundredthCents)
    } else {
      const preflight = await runBudgetPreflight(resolved.suiteName, resolved.commands, args.budgetHundredthCents, artifacts)
      budgetSummary = preflight.summary
      budgetSkipKeys = preflight.skipKeys
      budgetEvaluatedKeys = preflight.evaluatedKeys
    }
  }

  const budgetEnvOverrides: Record<string, string> = {}
  if (args.budgetHundredthCents !== undefined) {
    budgetEnvOverrides['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = JSON.stringify(budgetSkipKeys)
    budgetEnvOverrides['AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS'] = JSON.stringify(budgetEvaluatedKeys)
  }
  if (!args.adaptiveConcurrency) {
    budgetEnvOverrides['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY'] = '0'
  }

  const exitCode = await runBunTest(
    filesToRun,
    artifacts,
    args.passthroughArgs,
    args.preserveTestOutput,
    [],
    budgetEnvOverrides
  )

  const junitCases = await parseJunit(artifacts.junitPath)
  const metrics = await readMetrics(artifacts.metricsLogPath)

  const endedAtIso = new Date().toISOString()
  const endedAtMs = Date.now()
  const reportData = await buildTestReportData(junitCases, metrics, artifacts, endedAtIso, endedAtMs, argv.slice(2), budgetSummary)
  await writeReportJson(artifacts, reportData)
  if (typeof reportData['e2e'] === 'object' && reportData['e2e'] !== null) {
    await writeJsonFile(artifacts.e2eReportJsonPath, reportData['e2e'] as Record<string, unknown>)
  }
  const calibrationReport = await buildModelCalibrationReport(artifacts.rootDir)
  await writeJsonFile(artifacts.calibrationReportJsonPath, calibrationReport as unknown as Record<string, unknown>)
  l.write('info', `Model calibration report: ${normalizeRepoPath(artifacts.calibrationReportJsonPath)}`)
  if (calibrationReport.recommendedModels > 0) {
    l.write('info', `Model calibration recommendations found for ${calibrationReport.recommendedModels} model entr${calibrationReport.recommendedModels === 1 ? 'y' : 'ies'}`)
  }

  return exitCode
}

const runPriceMode = async (
  args: RunnerArgs,
  allFiles: string[],
  artifacts: TestRunArtifacts,
  argv: string[]
): Promise<number> => {
  let suiteName = 'All mapped tests'
  let results: PriceCommandResult[] = []
  let budgetSummary: BudgetPreflightSummary | undefined
  let exitCode = 0

  const resolved = resolvePriceSelection(allFiles, args.pathFilters, { mode: 'price' })
  suiteName = resolved.suiteName

  if (resolved.commands.length === 0) {
    l.write('info', 'No pricing commands resolved for the selected paths; treating selection as a zero-cost price pass')
    exitCode = 0
    results = []
    budgetSummary = args.budgetHundredthCents !== undefined ? buildEmptyBudgetSummary(suiteName, args.budgetHundredthCents) : undefined
  } else {
    const suiteResult = await runPriceSuite(suiteName, resolved.commands, artifacts, args.budgetHundredthCents)
    results = suiteResult.results
    budgetSummary = suiteResult.budgetSummary
    exitCode = suiteResult.exitCode
  }

  const endedAtIso = new Date().toISOString()
  const endedAtMs = Date.now()
  const reportData = buildPriceReportData(results, suiteName, artifacts, endedAtIso, endedAtMs, argv.slice(2), budgetSummary)
  await writeReportJson(artifacts, reportData)

  return exitCode
}

export const runTestRunner = async (argv: string[]): Promise<number> => {
  const args = parseRunnerArgs(argv)

  const glob = new Bun.Glob('test/test-cases/**/*.test.ts')
  const allFiles = (await Array.fromAsync(glob.scan({ dot: false }))).sort()

  const artifacts = await createRunArtifacts()
  if (!args.preserveTestOutput) {
    await cleanupTestOutputRoot(artifacts.rootDir, {
      keepRunDir: artifacts.runDir,
      preserveActiveRuns: true,
    })
  }
  installTimestampedConsole(artifacts.startedAtMs)
  l.write('info', `Test run artifacts: ${normalizeRepoPath(artifacts.runDir)}`)

  await appendRunnerLog(
    artifacts,
    `Run ID: ${artifacts.runId}\nStarted: ${artifacts.startedAtIso}\nArgs: ${argv.slice(2).join(' ')}\n`
  )

  let exitCode = 0
  try {
    exitCode = args.priceMode
      ? await runPriceMode(args, allFiles, artifacts, argv)
      : await runStandardTestMode(args, allFiles, artifacts, argv)
  } catch (error) {
    exitCode = 1
    const endedAtIso = new Date().toISOString()
    const endedAtMs = Date.now()
    const fallbackReport = {
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
      summary: {
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
      },
      error: error instanceof Error ? error.message : String(error)
    }
    await writeReportJson(artifacts, fallbackReport)

    l.error(error instanceof Error ? error.message : String(error))
  }

  const latestLogPath = await writeLatestRunLog(artifacts, exitCode)

  if (args.preserveTestOutput) {
    l.write('info', `Report JSON: ${normalizeRepoPath(artifacts.reportJsonPath)}`)
    if (!args.priceMode) {
      l.write('info', `E2E Report JSON: ${normalizeRepoPath(artifacts.e2eReportJsonPath)}`)
      l.write('info', `Model Calibration JSON: ${normalizeRepoPath(artifacts.calibrationReportJsonPath)}`)
    }
    l.write('info', `Latest log: ${normalizeRepoPath(latestLogPath)}`)
  } else {
    await cleanupRunArtifacts(artifacts)
    l.write('info', `Test output cleaned up; latest log: ${normalizeRepoPath(latestLogPath)}`)
  }

  return exitCode
}
