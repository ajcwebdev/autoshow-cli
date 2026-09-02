import type { BudgetPreflightResult, BudgetPreflightSummary, BudgetPreflightVariant, ExecutedBudgetPreflightVariant, ExecutedPriceCommand, HeadBudgetResult, PriceCommandObservation, PriceCommandSpec, RunnerArgs, TestRunArtifacts } from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { formatCost } from '~/utils/app-logger/formatters'
import { argvKeyFor, hashBudgetPreflightInputs, readBudgetPreflightCache, writeBudgetPreflightCache } from './budget-preflight-cache'
import { groupCommandsByKey, evaluatePriceObservations, toObservation } from './price-evaluation'
import { resolvePriceSelection } from './price-commands/resolve'
import { buildEmptyBudgetSummary, executePriceCommand, formatBudgetHundredthCents, logPriceCommandFailure, logSkippedKeys, PRICE_CONCURRENCY, withPriceExecutionConfig } from './price-execution'
import { runWithConcurrency } from './process-execution'

export const partitionBudgetCacheHits = (
  allVariants: BudgetPreflightVariant[],
  cache: ReadonlyMap<string, number>
): { hits: ExecutedBudgetPreflightVariant[], misses: BudgetPreflightVariant[] } => {
  const hits: ExecutedBudgetPreflightVariant[] = []
  const misses: BudgetPreflightVariant[] = []
  for (const item of allVariants) {
    const cachedCost = cache.get(argvKeyFor(item.entry.args))
    if (cachedCost === undefined) {
      misses.push(item)
      continue
    }
    const executed: ExecutedPriceCommand = {
      commandText: item.entry.args.join(' '),
      stdout: '',
      stderr: '',
      exitCode: 0,
      durationMs: 0,
      parsedCost: cachedCost
    }
    hits.push({ ...item, executed, observation: toObservation(item.entry, executed) })
  }
  return { hits, misses }
}

export const executeMissesAndUpdateCache = async (
  misses: BudgetPreflightVariant[],
  cache: ReadonlyMap<string, number>,
  fingerprint: string,
  artifacts: TestRunArtifacts
): Promise<ExecutedBudgetPreflightVariant[]> => {
  const executedMisses = await runWithConcurrency(misses, PRICE_CONCURRENCY, async item => {
    const executed = await executePriceCommand(item.entry, artifacts, 'BUDGET PREFLIGHT COMMAND')
    return { ...item, executed, observation: toObservation(item.entry, executed) }
  })
  const nextCache = new Map(cache)
  for (const result of executedMisses) {
    if (result.executed.exitCode === 0 && result.executed.parsedCost !== null) {
      nextCache.set(argvKeyFor(result.entry.args), result.executed.parsedCost)
    }
  }
  await writeBudgetPreflightCache(fingerprint, nextCache)
  return executedMisses
}

export const collectOrderedVariantObservations = (
  groupedCommands: { key: string, variants: PriceCommandSpec[] }[],
  executedVariants: ExecutedBudgetPreflightVariant[]
): PriceCommandObservation[] => {
  const groupResults = new Map<number, ExecutedBudgetPreflightVariant[]>()
  for (const result of executedVariants) {
    const list = groupResults.get(result.groupIndex) ?? []
    list.push(result)
    groupResults.set(result.groupIndex, list)
  }
  const observations: PriceCommandObservation[] = []
  for (const [index, group] of groupedCommands.entries()) {
    const variants = groupResults.get(index) ?? []
    variants.sort((a, b) => a.variantIndex - b.variantIndex)
    for (const { executed, observation, variantIndex } of variants) {
      observations.push(observation)
      if (observation.failureMessage !== null) {
        logPriceCommandFailure(executed, `  variant ${variantIndex + 1}/${group.variants.length}: FAIL exit=${executed.exitCode} (could not resolve numeric estimate)`)
      }
    }
  }
  return observations
}

const logBudgetPreflightSummary = (suiteName: string, budgetSummary: BudgetPreflightSummary, variantCount: number): void => {
  l.write('info', `${suiteName} budget preflight: ${budgetSummary.commandsRunnable}/${budgetSummary.commandsChecked} runnable, ${formatCost(budgetSummary.runnableEstimatedCostCents)}`, {
    category: 'pricing',
    metadata: { ...budgetSummary, variantCount }
  })
  logSkippedKeys('Skipped command list', budgetSummary)
}

export const runBudgetPreflight = async (
  suiteName: string,
  commands: PriceCommandSpec[],
  budgetHundredthCents: number,
  artifacts: TestRunArtifacts
): Promise<BudgetPreflightResult> => {
  const executionCommands = commands.map(withPriceExecutionConfig)
  const groupedCommands = groupCommandsByKey(executionCommands)
  if (groupedCommands.length === 0) {
    return { summary: buildEmptyBudgetSummary(suiteName, budgetHundredthCents), skipKeys: [], evaluatedKeys: [] }
  }

  l.write('info', `Running ${suiteName} budget preflight across ${groupedCommands.length} test key(s) (${executionCommands.length} command variant(s))`, { category: 'pricing' })
  l.write('info', `Budget: ${formatBudgetHundredthCents(budgetHundredthCents)}`, { category: 'pricing' })
  const allVariants = groupedCommands.flatMap((group, groupIndex) =>
    group.variants.map((entry, variantIndex) => ({ entry, groupIndex, variantIndex }))
  )
  const fingerprint = await hashBudgetPreflightInputs(executionCommands)
  const cache = await readBudgetPreflightCache(fingerprint)
  const { hits, misses } = partitionBudgetCacheHits(allVariants, cache)
  l.write('info', `Budget preflight cache: ${hits.length} hit(s), ${misses.length} miss(es)`, { category: 'pricing' })
  const executedMisses = await executeMissesAndUpdateCache(misses, cache, fingerprint, artifacts)
  const observations = collectOrderedVariantObservations(groupedCommands, [...hits, ...executedMisses])
  const evaluation = evaluatePriceObservations(suiteName, observations, budgetHundredthCents)
  const budgetSummary = evaluation.budgetSummary ?? buildEmptyBudgetSummary(suiteName, budgetHundredthCents)
  logBudgetPreflightSummary(suiteName, budgetSummary, executionCommands.length)
  if (budgetSummary.commandsFailed > 0) {
    throw new Error(`Budget preflight failed for ${budgetSummary.commandsFailed} command(s); cannot continue with --budget`)
  }
  return { summary: budgetSummary, skipKeys: budgetSummary.skipKeys, evaluatedKeys: groupedCommands.map(group => group.key) }
}

const EMPTY_BUDGET_HEAD: HeadBudgetResult = { summary: undefined, skipKeys: [], evaluatedKeys: [] }

export const prepareBudgetPreflight = async (
  args: RunnerArgs,
  allFiles: string[],
  artifacts: TestRunArtifacts
): Promise<HeadBudgetResult> => {
  if (args.priceMode || args.budgetHundredthCents === undefined) return EMPTY_BUDGET_HEAD
  const resolved = resolvePriceSelection(allFiles, args.pathFilters, { budgetSkippableOnly: true })
  if (resolved.commands.length === 0) {
    l.write('info', 'No budget-skippable pricing commands resolved for --budget preflight; any selected budgeted tests will fail closed as unevaluated', { category: 'pricing' })
    return {
      summary: buildEmptyBudgetSummary(resolved.suiteName, args.budgetHundredthCents),
      skipKeys: [],
      evaluatedKeys: [],
    }
  }
  const preflight = await runBudgetPreflight(resolved.suiteName, resolved.commands, args.budgetHundredthCents, artifacts)
  return { summary: preflight.summary, skipKeys: preflight.skipKeys, evaluatedKeys: preflight.evaluatedKeys }
}
