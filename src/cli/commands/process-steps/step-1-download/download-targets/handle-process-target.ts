import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { getYtDlpBinary, hasYtDlpBinary } from '~/cli/commands/process-steps/shared/shared-yt-dlp-binary'
import { isHtmlArticleTarget, isLikelyUrl } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { classifyTopLevelTarget } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-collection'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
import { planProcessTargetBatchExecution, resolveProcessTargetPlan } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-process-target-plan'
import { hasConfiguredOcrProviderSelection, HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/inactive-flag-warnings'
import { loadConfig, resolveConfigPath, resolveMaxCents } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { setupYtDependencies } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio'
import { hasExtractGenericSelectorOccurrences, normalizeExtractGenericSelectorFlags, stripExtractGenericSelectorFlags, stripExtractGenericSelectorOccurrences } from '~/cli/flags/service-selector-normalization/extract-selectors'
import type { AggregatedPriceEstimate, CliRawParsed, ExtractSelectorInputRoutes, ProcessCommand, ProcessPlanningOptions, ResolvedProcessTargetDoubleDash } from '~/types'
import { UsageError, InfraError } from '~/utils/error-handler'
import { fileExists } from '~/utils/cli-utils'
import { childEnv } from '~/utils/child-env'
import * as l from '~/utils/app-logger/app-logger'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { runPreflight } from '~/cli/commands/pricing-orchestration/preflight'
import { executeBatchPlan } from './download-batch/batch-executor'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { buildExpectedFilesList } from './expected-output'
import { formatCents, reportSuitePriceEstimate, shouldRunCommandPreflight } from './process-target-preflight'
import { buildUnsupportedExtractInputMessage } from './process-target-validation'
import { handleSingleTarget } from './single/single-target-runner'
import { configureModelCostFilter } from '~/cli/commands/pricing-orchestration/model-cost-filter'

const isDownloadCommand = (command: ProcessCommand): boolean => command === 'download'

const buildPassthroughUnsupportedMessage = (): string =>
  'yt-dlp passthrough (--) is only supported for the "download" command'

export const resolveProcessTargetDoubleDash = (
  command: ProcessCommand,
  target: string | undefined,
  doubleDash: string[] = []
): ResolvedProcessTargetDoubleDash => {
  if (typeof target === 'string' && target.length > 0) {
    if (doubleDash.length > 0) {
      if (!isDownloadCommand(command)) {
        throw UsageError(buildPassthroughUnsupportedMessage())
      }
      return { kind: 'target', resolvedTarget: target, ytDlpPassthroughArgs: [...doubleDash] }
    }
    return { kind: 'target', resolvedTarget: target }
  }

  if (doubleDash.length > 0 && doubleDash[0]?.startsWith('-')) {
    if (!isDownloadCommand(command)) {
      throw UsageError(buildPassthroughUnsupportedMessage())
    }
    return { kind: 'raw-yt-dlp', ytDlpPassthroughArgs: [...doubleDash] }
  }

  if (doubleDash.length === 1) {
    return { kind: 'target', resolvedTarget: doubleDash[0] as string }
  }

  if (doubleDash.length > 1) {
    throw UsageError(`Too many positional inputs for "${command}": ${doubleDash.join(' ')}. Run: bun autoshow help ${command}`)
  }

  throw UsageError(`Missing input for "${command}". Run: bun autoshow help ${command}`)
}

const runRawYtDlp = async (args: string[]): Promise<void> => {
  if (!hasYtDlpBinary()) {
    await setupYtDependencies()
  }

  const proc = Bun.spawn([getYtDlpBinary(), ...args], {
    env: childEnv(),
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw InfraError(`yt-dlp exited with code ${exitCode}`, {
      stage: 'download:yt-dlp-passthrough',
      exitCode,
      retryable: false,
      metadata: { ytDlpExitCode: exitCode }
    })
  }
}

const addExtractSelectorRoute = (
  routes: ExtractSelectorInputRoutes,
  family: string
): void => {
  if (family === 'media') {
    routes.media = true
  } else if (family === 'document') {
    routes.document = true
  } else if (family === 'html_article' || family === 'x_space') {
    routes.article = true
  }
}

const resolveExtractSelectorInputRoutes = async (
  command: ProcessCommand,
  plan: Awaited<ReturnType<typeof resolveProcessTargetPlan>>,
  opts: ProcessPlanningOptions,
  resolvedTarget: string
): Promise<ExtractSelectorInputRoutes> => {
  const routes: ExtractSelectorInputRoutes = { media: false, document: false, article: false }
  if (!isExtractCommand(command)) {
    return routes
  }

  if (plan.kind === 'single') {
    const routing = await resolveInputRoutingForCommand(command, plan.target, opts)
    addExtractSelectorRoute(routes, routing.family)
    return routes
  }

  const batchPlan = await planProcessTargetBatchExecution(plan, command, opts, resolvedTarget)
  for (const plannedInput of batchPlan?.plannedInputs ?? []) {
    addExtractSelectorRoute(routes, plannedInput.inputFamily)
  }
  return routes
}

const resolveDirectExtractSelectorInputRoutes = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: ProcessPlanningOptions
): Promise<ExtractSelectorInputRoutes | undefined> => {
  if (!isExtractCommand(command)) {
    return undefined
  }

  if (!isLikelyUrl(resolvedTarget)) {
    const topLevel = await classifyTopLevelTarget(resolvedTarget)
    if (topLevel.kind !== 'single') {
      return undefined
    }
  }

  const routes: ExtractSelectorInputRoutes = { media: false, document: false, article: false }
  const routing = await resolveInputRoutingForCommand(command, resolvedTarget, opts)
  addExtractSelectorRoute(routes, routing.family)
  return routes
}

type BuiltProcessOptions = ReturnType<typeof buildOptsFromFlags> & { configPath: string }
type ProcessTargetPlan = Awaited<ReturnType<typeof resolveProcessTargetPlan>>

const resolveNormalizedProcessOptions = async (input: {
  command: ProcessCommand
  resolvedTarget: string
  rawFlags: Record<string, unknown>
  rawParsed: Pick<CliRawParsed, 'explicitFlags' | 'flagOccurrences'>
}): Promise<{
  options: BuiltProcessOptions
  selectorPlan?: ProcessTargetPlan | undefined
  config: Awaited<ReturnType<typeof loadConfig>>
}> => {
  const configPathOverride = typeof input.rawFlags['config-path'] === 'string' ? input.rawFlags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const configExplicitFlags = input.rawParsed.explicitFlags
  const mergedFlags = mergeConfigIntoRawFlags(
    input.rawFlags,
    config,
    configExplicitFlags,
    input.command === 'extract' ? 'extract' : input.command === 'download' ? 'download' : 'metadata'
  )
  let optionFlags = mergedFlags
  let explicitFlags = configExplicitFlags
  let optionOccurrences = input.rawParsed.flagOccurrences
  let selectorPlan: ProcessTargetPlan | undefined
  if (isExtractCommand(input.command) && hasExtractGenericSelectorOccurrences(optionOccurrences)) {
    const preliminaryFlags = stripExtractGenericSelectorFlags(mergedFlags)
    const preliminaryOccurrences = stripExtractGenericSelectorOccurrences(optionOccurrences)
    const preliminaryExplicitFlags = new Set(preliminaryOccurrences.map(occurrence => occurrence.name))
    const preliminaryOpts = {
      ...buildOptsFromFlags(preliminaryFlags, {}, preliminaryExplicitFlags, {
        flagOccurrences: preliminaryOccurrences,
        scope: input.command === 'extract' ? 'extract' : input.command === 'download' ? 'download' : 'metadata'
      }),
      configPath: resolvedConfigPath,
    }
    const selectorRoutes = await resolveDirectExtractSelectorInputRoutes(input.command, input.resolvedTarget, preliminaryOpts)
      ?? await (async (): Promise<ExtractSelectorInputRoutes> => {
        selectorPlan = await resolveProcessTargetPlan(input.command, input.resolvedTarget, preliminaryOpts)
        return await resolveExtractSelectorInputRoutes(input.command, selectorPlan, preliminaryOpts, input.resolvedTarget)
      })()
    const normalized = normalizeExtractGenericSelectorFlags(mergedFlags, configExplicitFlags, optionOccurrences, selectorRoutes)
    optionFlags = normalized.flags
    explicitFlags = normalized.explicitFlags
    optionOccurrences = normalized.flagOccurrences
    selectorPlan = undefined
  }
  return {
    options: {
      ...buildOptsFromFlags(optionFlags, {}, explicitFlags, {
        flagOccurrences: optionOccurrences,
        scope: input.command === 'extract' ? 'extract' : input.command === 'download' ? 'download' : 'metadata'
      }),
      configPath: resolvedConfigPath,
    },
    selectorPlan,
    config,
  }
}

const planTargetExecutionPhase = async (input: {
  command: ProcessCommand
  resolvedTarget: string
  options: BuiltProcessOptions
  selectorPlan?: ProcessTargetPlan | undefined
}) => {
  const plan = input.selectorPlan ?? await resolveProcessTargetPlan(input.command, input.resolvedTarget, input.options)
  const singleRouting = plan.kind === 'single' && isExtractCommand(input.command) ? await resolveInputRoutingForCommand(input.command, plan.target, input.options) : undefined
  if (singleRouting?.family === 'unsupported') throw UsageError(buildUnsupportedExtractInputMessage(input.resolvedTarget))
  if (plan.kind === 'single' && !isLikelyUrl(plan.target) && !(await fileExists(plan.target))) {
    const { extractSpaceIdsFromText } = await import('~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/x-spaces/input')
    if (!extractSpaceIdsFromText(plan.target).includes(plan.target.trim())) throw UsageError(`Input does not exist: ${plan.target}. Run: bun autoshow help ${input.command}`)
  }
  const batchPlan = await planProcessTargetBatchExecution(plan, input.command, input.options, input.resolvedTarget)
  const preflightTargets = batchPlan ? batchPlan.items : plan.kind === 'single' ? [plan.target] : []
  return { plan, batchPlan, preflightTargets }
}

type PreflightPhaseResult =
  | { kind: 'reported' }
  | { kind: 'continue', singleEstimate?: AggregatedPriceEstimate | undefined }

const runPriceAndBudgetPhase = async (input: {
  command: ProcessCommand
  options: BuiltProcessOptions
  preflightTargets: string[]
  maxCents?: number | undefined
}): Promise<PreflightPhaseResult> => {
  const { command, options, preflightTargets } = input
  if (options.price) {
    if (preflightTargets.length === 0) return { kind: 'reported' }
    if (preflightTargets.length === 1) {
      const target = preflightTargets[0] as string
      const estimate = await buildAggregatedPriceEstimate(command, target, options, undefined)
      l.report.estimate(estimate)
      if (await isHtmlArticleTarget(target, options) && hasConfiguredOcrProviderSelection(options)) l.warn(`${HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING.slice(0, -1)} during extraction pricing and execution.`, { category: 'pipeline' })
      l.report.expectedOutput('./output/<timestamp>_<label>/', await buildExpectedFilesList(command, options, target))
      return { kind: 'reported' }
    }
    await reportSuitePriceEstimate(command, preflightTargets, options)
    return { kind: 'reported' }
  }
  if (!shouldRunCommandPreflight(options, input.maxCents)) return { kind: 'continue' }
  if (preflightTargets.length === 1) {
    const { estimate, shouldExit } = await runPreflight(command, preflightTargets[0] as string, options, input.maxCents, undefined)
    return shouldExit ? { kind: 'reported' } : { kind: 'continue', singleEstimate: estimate }
  }
  if (preflightTargets.length > 1) {
    const suiteCost = await reportSuitePriceEstimate(command, preflightTargets, options)
    if (input.maxCents !== undefined && suiteCost > input.maxCents) {
      if (!options.allowOverBudget) throw UsageError(`Estimated suite cost ${formatCents(suiteCost)} exceeds configured budget ${formatCents(input.maxCents)}. Use --allow-over-budget to proceed.`)
      l.warn(`Estimated suite cost ${formatCents(suiteCost)} exceeds budget ${formatCents(input.maxCents)} — continuing because --allow-over-budget is set.`, { category: 'pricing', metadata: { estimatedCostCents: suiteCost, budgetCents: input.maxCents, allowOverBudget: true } })
    }
  }
  return { kind: 'continue' }
}

const dispatchTargetExecutionPhase = async (input: {
  command: ProcessCommand
  resolvedTarget: string
  options: BuiltProcessOptions
  plan: ProcessTargetPlan
  batchPlan: Awaited<ReturnType<typeof planProcessTargetBatchExecution>>
  singleEstimate?: AggregatedPriceEstimate | undefined
}): Promise<void> => {
  if (input.plan.kind !== 'single' && !input.batchPlan) return
  if (input.batchPlan) {
    if (input.plan.kind === 'directory' && input.batchPlan.initialRecords.length === 0) {
      l.warn(`No inputs found in ${input.resolvedTarget}`, { category: 'pipeline', metadata: { target: input.resolvedTarget } })
      return
    }
    if (input.plan.kind === 'youtube_collection') {
      l.write('info', `Detected YouTube collection URL, processing ${input.batchPlan.initialRecords.length} videos`, { category: 'pipeline', metadata: { target: input.resolvedTarget, itemCount: input.batchPlan.initialRecords.length } })
    }
    await executeBatchPlan(input.command, input.options, input.batchPlan)
    return
  }
  await handleSingleTarget(input.resolvedTarget, input.command, input.options, input.singleEstimate)
}

export const handleProcessTarget = async (
  command: ProcessCommand,
  target: string | undefined,
  rawFlags: Record<string, unknown>,
  rawParsed: Pick<CliRawParsed, 'doubleDash' | 'explicitFlags' | 'flagOccurrences'>
): Promise<void> => {
  if (command === 'write') {
    throw UsageError('write no longer runs through extract. Use bun autoshow write <file.md|.txt>.')
  }
  const doubleDash = resolveProcessTargetDoubleDash(command, target, rawParsed.doubleDash)
  if (doubleDash.kind === 'raw-yt-dlp') {
    await runRawYtDlp(doubleDash.ytDlpPassthroughArgs)
    return
  }
  const normalized = await resolveNormalizedProcessOptions({ command, resolvedTarget: doubleDash.resolvedTarget, rawFlags, rawParsed })
  if (doubleDash.ytDlpPassthroughArgs?.length) {
    normalized.options.ytDlpPassthroughArgs = doubleDash.ytDlpPassthroughArgs
    l.write('info', `Forwarding ${doubleDash.ytDlpPassthroughArgs.length} passthrough arg(s) to yt-dlp`, { category: 'pipeline', metadata: { passthroughArgCount: doubleDash.ytDlpPassthroughArgs.length } })
  }
  const planned = await planTargetExecutionPhase({ command, resolvedTarget: doubleDash.resolvedTarget, options: normalized.options, selectorPlan: normalized.selectorPlan })
  if (normalized.options.maxModelCents !== undefined) {
    while (true) {
      const estimates: AggregatedPriceEstimate[] = []
      for (const preflightTarget of planned.preflightTargets) {
        estimates.push(await buildAggregatedPriceEstimate(command, preflightTarget, normalized.options, undefined))
      }
      if (configureModelCostFilter(normalized.options, estimates).length === 0) break
    }
  }
  const preflight = await runPriceAndBudgetPhase({ command, options: normalized.options, preflightTargets: planned.preflightTargets, maxCents: resolveMaxCents(normalized.config.pricing) })
  if (preflight.kind === 'reported') return
  await dispatchTargetExecutionPhase({ command, resolvedTarget: doubleDash.resolvedTarget, options: normalized.options, plan: planned.plan, batchPlan: planned.batchPlan, singleEstimate: preflight.singleEstimate })
}
