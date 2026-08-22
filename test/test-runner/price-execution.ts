import { appendFile } from 'node:fs/promises'
import type { BudgetPreflightSummary, ExecutedPriceCommand, PriceCommandObservation, PriceCommandResult, PriceCommandSpec, TestRunArtifacts } from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { formatCost } from '~/utils/app-logger/formatters'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { childEnv } from '~/utils/child-env'
import { serializeDiagnosticError } from '~/utils/error-handler'
import { appendCommandLog } from './artifacts'
import { withEmptyPriceConfig } from './price-command-config'
import { evaluatePriceObservations, toObservation } from './price-evaluation'
import { runWithConcurrency } from './process-execution'
import { formatOutputTail, formatProgressCounter, parseCommandEstimatedTotal } from './utils'

export const PRICE_CONCURRENCY = 25

const budgetHundredthCentsToCents = (budgetHundredthCents: number): number => budgetHundredthCents / 100
export const formatBudgetHundredthCents = (budgetHundredthCents: number): string => formatCost(budgetHundredthCentsToCents(budgetHundredthCents))

export const withPriceExecutionConfig = (entry: PriceCommandSpec): PriceCommandSpec => {
  const args = withEmptyPriceConfig(entry.args)
  return args === entry.args ? entry : { ...entry, args }
}

let commandMetricWriteWarned = false

const writeCommandMetric = async (artifacts: TestRunArtifacts, record: Record<string, unknown>): Promise<void> => {
  try {
    await appendFile(artifacts.metricsLogPath, `${JSON.stringify(record)}\n`)
  } catch (error) {
    if (commandMetricWriteWarned) return
    commandMetricWriteWarned = true
    l.warn(`Could not append to the runner metrics log at ${artifacts.metricsLogPath}; pricing reports will be incomplete`, {
      category: 'pricing',
      metadata: { metricsLogPath: artifacts.metricsLogPath, error: serializeDiagnosticError(error) }
    })
  }
}

export const buildPriceSpawnArgs = (entry: PriceCommandSpec, artifacts: TestRunArtifacts): string[] => {
  const spawnArgs = [...entry.args, '--output-root', `${artifacts.runDir}/outputs/price`]
  const bundle = process.env['AUTOSHOW_TEST_CLI_BUNDLE']?.trim()
  const cliArgs = bundle && spawnArgs[0] === 'src/cli/create-cli.ts'
    ? [bundle, ...spawnArgs.slice(1)]
    : spawnArgs
  return ['bun', '--no-env-file', ...cliArgs]
}

export const executePriceCommand = async (
  entry: PriceCommandSpec,
  artifacts: TestRunArtifacts,
  logLabel: string
): Promise<ExecutedPriceCommand> => {
  const start = Date.now()
  const commandArgs = buildPriceSpawnArgs(entry, artifacts)
  const commandText = commandArgs.join(' ')
  const proc = Bun.spawn(commandArgs, {
    env: childEnv({ set: { FORCE_COLOR: '1', AUTOSHOW_PROJECT_ROOT: process.cwd() } }),
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

  await appendCommandLog(artifacts, `\n=== ${logLabel} ${entry.name} ===\ncmd: ${commandText}\nexit: ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}\n`)
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
  return { commandText, stdout, stderr, exitCode, durationMs, parsedCost }
}

export const buildEmptyBudgetSummary = (suiteName: string, budgetHundredthCents: number): BudgetPreflightSummary => ({
  suiteName,
  budgetHundredthCents,
  commandsChecked: 0,
  commandsRunnable: 0,
  commandsSkipped: 0,
  commandsFailed: 0,
  runnableEstimatedCostCents: 0,
  skipKeys: [],
  skippedEntries: [],
})

export const logPriceCommandFailure = (executed: ExecutedPriceCommand, message: string): void => {
  l.error(message, { category: 'command' })
  for (const tail of [formatOutputTail('stdout', executed.stdout), formatOutputTail('stderr', executed.stderr)]) {
    if (tail !== undefined) l.error(tail, { category: 'command' })
  }
}

export const logSkippedKeyTable = (label: string, summary: BudgetPreflightSummary): void => {
  if (summary.skipKeys.length === 0) return
  l.write('info', `${label} (${summary.skipKeys.length})`, {
    category: 'pricing',
    humanTable: createKeyValueTable(summary.skippedEntries.map(entry => [entry.key, formatCost(entry.selectedCostCents)] as [string, string])),
  })
}

export const runPriceSuite = async (
  suiteName: string,
  commands: PriceCommandSpec[],
  artifacts: TestRunArtifacts,
  budgetHundredthCents?: number
): Promise<{ exitCode: number, results: PriceCommandResult[], budgetSummary: BudgetPreflightSummary | undefined }> => {
  const executionCommands = commands.map(withPriceExecutionConfig)
  if (executionCommands.length === 0) {
    l.write('info', `No ${suiteName} pricing commands resolved; treating selection as a zero-cost price pass`, { category: 'pricing' })
    return {
      exitCode: 0,
      results: [],
      budgetSummary: budgetHundredthCents !== undefined ? buildEmptyBudgetSummary(suiteName, budgetHundredthCents) : undefined,
    }
  }

  l.write('info', `Running ${suiteName} pricing preflight across ${executionCommands.length} command(s)`, { category: 'pricing' })
  if (budgetHundredthCents !== undefined) {
    l.write('info', `Budget filter (per test key): ${formatBudgetHundredthCents(budgetHundredthCents)}`, { category: 'pricing' })
  }
  const executedResults = await runWithConcurrency(executionCommands, PRICE_CONCURRENCY, async entry => {
    const executed = await executePriceCommand(entry, artifacts, 'PRICE COMMAND')
    return { entry, executed, observation: toObservation(entry, executed) }
  })

  const observations: PriceCommandObservation[] = []
  for (const [index, { entry, executed, observation }] of executedResults.entries()) {
    observations.push(observation)
    if (observation.failureMessage !== null) {
      logPriceCommandFailure(executed, `${formatProgressCounter(index, executionCommands.length)} ${entry.name} — FAIL exit=${executed.exitCode}`)
    } else {
      l.write('info', `${formatProgressCounter(index, executionCommands.length)} ${entry.name} — cost: ${formatCost(observation.costCents as number)}`, { category: 'pricing' })
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
  l.write('success', `${suiteName} Pricing Summary`, { category: 'pricing', humanTable: createKeyValueTable(summaryRows) })
  if (evaluation.budgetSummary) logSkippedKeyTable('Skipped test key list', evaluation.budgetSummary)
  return {
    exitCode: evaluation.failedCommands > 0 ? 1 : 0,
    results: evaluation.commandResults,
    budgetSummary: evaluation.budgetSummary,
  }
}
