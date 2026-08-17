import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { getYtDlpBinary, hasYtDlpBinary } from '~/cli/commands/process-steps/shared/shared-yt-dlp-binary'
import { isHtmlArticleTarget, isLikelyUrl } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { classifyTopLevelTarget } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-collection'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
import { planProcessTargetBatchExecution, resolveProcessTargetPlan } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-process-target-plan'
import { hasConfiguredOcrProviderSelection, HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/inactive-flag-warnings'
import { readPromptFileText, resolveWriteTextProjectDefaults } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { loadConfig, resolveConfigPath, resolveMaxCents } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { setupYtDependencies } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio'
import { hasExtractGenericSelectorOccurrences, normalizeExtractGenericSelectorFlags, stripExtractGenericSelectorFlags, stripExtractGenericSelectorOccurrences } from '~/cli/flags/service-selector-normalization/extract-selectors'
import { normalizeWriteStepSelectorFlags } from '~/cli/flags/service-selector-normalization/step-selectors'
import type { AggregatedPriceEstimate, CliRawParsed, ExtractSelectorInputRoutes, ProcessCommand, ProcessPlanningOptions, ResolvedProcessTargetDoubleDash } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { runPreflight } from '~/cli/commands/pricing-orchestration/preflight'
import { executeBatchPlan } from './download-batch/batch-executor'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { buildBatchExpectedFilesList, buildExpectedFilesList } from './expected-output'
import { formatCents, reportSuitePriceEstimate, shouldRunCommandPreflight } from './process-target-preflight'
import { buildUnsupportedExtractInputMessage, validateWriteStep2ProviderSelection } from './process-target-validation'
import { handleSingleTarget } from './single/single-target-runner'

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
        throw CLIUsageError(buildPassthroughUnsupportedMessage())
      }
      return { kind: 'target', resolvedTarget: target, ytDlpPassthroughArgs: [...doubleDash] }
    }
    return { kind: 'target', resolvedTarget: target }
  }

  if (doubleDash.length > 0 && doubleDash[0]?.startsWith('-')) {
    if (!isDownloadCommand(command)) {
      throw CLIUsageError(buildPassthroughUnsupportedMessage())
    }
    return { kind: 'raw-yt-dlp', ytDlpPassthroughArgs: [...doubleDash] }
  }

  if (doubleDash.length === 1) {
    return { kind: 'target', resolvedTarget: doubleDash[0] as string }
  }

  if (doubleDash.length > 1) {
    throw CLIUsageError(`Too many positional inputs for "${command}": ${doubleDash.join(' ')}. Run: bun autoshow help ${command}`)
  }

  throw CLIUsageError(`Missing input for "${command}". Run: bun autoshow help ${command}`)
}

const runRawYtDlp = async (args: string[]): Promise<void> => {
  if (!hasYtDlpBinary()) {
    await setupYtDependencies()
  }

  const proc = Bun.spawn([getYtDlpBinary(), ...args], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const error = new Error(`yt-dlp exited with code ${exitCode}`)
    ;(error as Error & { exitCode?: number }).exitCode = exitCode
    throw error
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

export const handleProcessTarget = async (
  command: ProcessCommand,
  target: string | undefined,
  rawFlags: Record<string, unknown>,
  rawParsed: Pick<CliRawParsed, 'doubleDash' | 'explicitFlags' | 'flagOccurrences'>
): Promise<void> => {
  const doubleDash = rawParsed.doubleDash
  const resolvedDoubleDash = resolveProcessTargetDoubleDash(command, target, doubleDash)
  if (resolvedDoubleDash.kind === 'raw-yt-dlp') {
    await runRawYtDlp(resolvedDoubleDash.ytDlpPassthroughArgs)
    return
  }

  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const configExplicitFlags = rawParsed.explicitFlags
  const mergedFlags = mergeConfigIntoRawFlags(rawFlags, config, configExplicitFlags)
  let optionFlags = mergedFlags
  let explicitFlags = configExplicitFlags
  let optionOccurrences = rawParsed.flagOccurrences
  let selectorPlan: Awaited<ReturnType<typeof resolveProcessTargetPlan>> | undefined

  if (isExtractCommand(command) && hasExtractGenericSelectorOccurrences(optionOccurrences)) {
    const preliminaryFlags = stripExtractGenericSelectorFlags(mergedFlags)
    const preliminaryOccurrences = stripExtractGenericSelectorOccurrences(optionOccurrences)
    const preliminaryExplicitFlags = new Set(preliminaryOccurrences.map((occurrence) => occurrence.name))
    const preliminaryOpts = {
      ...buildOptsFromFlags(
        true,
        preliminaryFlags,
        {},
        preliminaryExplicitFlags,
        preliminaryOccurrences
      ),
      configPath: resolvedConfigPath
    }
    const selectorRoutes = await resolveDirectExtractSelectorInputRoutes(command, resolvedDoubleDash.resolvedTarget, preliminaryOpts)
      ?? await (async (): Promise<ExtractSelectorInputRoutes> => {
        selectorPlan = await resolveProcessTargetPlan(command, resolvedDoubleDash.resolvedTarget, preliminaryOpts)
        return await resolveExtractSelectorInputRoutes(command, selectorPlan, preliminaryOpts, resolvedDoubleDash.resolvedTarget)
      })()
    const normalized = normalizeExtractGenericSelectorFlags(mergedFlags, configExplicitFlags, optionOccurrences, selectorRoutes)
    optionFlags = normalized.flags
    explicitFlags = normalized.explicitFlags
    optionOccurrences = normalized.flagOccurrences
    selectorPlan = undefined
  }

  if (command === 'write') {
    const selectorNormalized = normalizeWriteStepSelectorFlags(optionFlags, explicitFlags, optionOccurrences)
    optionFlags = selectorNormalized.flags
    explicitFlags = selectorNormalized.explicitFlags
    optionOccurrences = selectorNormalized.flagOccurrences
  }

  const opts = {
    ...buildOptsFromFlags(
      isExtractCommand(command) || command === 'download' || command === 'metadata',
      optionFlags,
      {},
      explicitFlags,
      optionOccurrences
    ),
    configPath: resolvedConfigPath
  }

  const maxCents = resolveMaxCents(config.pricing)

  const resolvedTarget = resolvedDoubleDash.resolvedTarget
  if (resolvedDoubleDash.ytDlpPassthroughArgs && resolvedDoubleDash.ytDlpPassthroughArgs.length > 0) {
    opts.ytDlpPassthroughArgs = resolvedDoubleDash.ytDlpPassthroughArgs
    l.write('info', `Forwarding ${resolvedDoubleDash.ytDlpPassthroughArgs.length} passthrough arg(s) to yt-dlp`)
  }

  const writeProjectDefaults = command === 'write'
    ? await resolveWriteTextProjectDefaults(resolvedTarget, opts, explicitFlags)
    : undefined
  const effectiveOpts = writeProjectDefaults
    ? {
        ...opts,
        textInput: true,
        promptFile: writeProjectDefaults.promptFile,
        renderedOutDir: writeProjectDefaults.renderedOutDir,
        trackList: writeProjectDefaults.trackList
      }
    : opts

  if (writeProjectDefaults && !explicitFlags.has('prompt-file')) {
    await readPromptFileText(writeProjectDefaults.promptFile).catch(() => {
      throw CLIUsageError(`write project mode requires ${writeProjectDefaults.projectDir}/prompt.md or an explicit --prompt-file`)
    })
  }

  validateWriteStep2ProviderSelection(command, effectiveOpts)

  const plan = selectorPlan ?? await resolveProcessTargetPlan(command, resolvedTarget, effectiveOpts)
  const singleRouting = plan.kind === 'single' && isExtractCommand(command)
    ? await resolveInputRoutingForCommand(command, plan.target, effectiveOpts)
    : undefined

  if (singleRouting?.family === 'unsupported') {
    throw CLIUsageError(buildUnsupportedExtractInputMessage(resolvedTarget))
  }

  const batchPlan = await planProcessTargetBatchExecution(plan, command, effectiveOpts, resolvedTarget)
  const preflightTargets = batchPlan
    ? batchPlan.items
    : plan.kind === 'single'
      ? [plan.target]
      : []
  const shouldRunPreflight = shouldRunCommandPreflight(effectiveOpts, maxCents)

  if (effectiveOpts.price) {
    if (preflightTargets.length === 0) {
      return
    }

    if (preflightTargets.length === 1) {
      const estimate = await buildAggregatedPriceEstimate(command, preflightTargets[0] as string, effectiveOpts, undefined)
      l.report.estimate(estimate)
      if (typeof preflightTargets[0] === 'string' && await isHtmlArticleTarget(preflightTargets[0] as string, effectiveOpts) && hasConfiguredOcrProviderSelection(effectiveOpts)) {
        l.warn(`${HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING.slice(0, -1)} during extraction pricing and execution.`)
      }
      l.report.expectedOutput('./output/<timestamp>_<label>/', await buildExpectedFilesList(command, effectiveOpts, preflightTargets[0] as string))
      return
    }

    await reportSuitePriceEstimate(command, preflightTargets, effectiveOpts)
    if (writeProjectDefaults) {
      l.report.expectedOutput(
        './output/<timestamp>_text/',
        await buildBatchExpectedFilesList(command, effectiveOpts, preflightTargets[0] as string)
      )
    }
    return
  }

  let singleEstimate: AggregatedPriceEstimate | undefined
  if (shouldRunPreflight) {
    if (preflightTargets.length === 1) {
      const { estimate, shouldExit } = await runPreflight(command, preflightTargets[0] as string, effectiveOpts, maxCents, undefined)
      singleEstimate = estimate
      if (shouldExit) return
    } else if (preflightTargets.length > 1) {
      const suiteTotalEstimatedCost = await reportSuitePriceEstimate(command, preflightTargets, effectiveOpts)
      if (maxCents !== undefined && suiteTotalEstimatedCost > maxCents) {
        if (!effectiveOpts.allowOverBudget) {
          throw CLIUsageError(
            `Estimated suite cost ${formatCents(suiteTotalEstimatedCost)} exceeds configured budget ${formatCents(maxCents)}. Use --allow-over-budget to proceed.`
          )
        }
        l.warn(`Estimated suite cost ${formatCents(suiteTotalEstimatedCost)} exceeds budget ${formatCents(maxCents)} — continuing because --allow-over-budget is set.`)
      }
    }
  }

  if (plan.kind !== 'single' && !batchPlan) {
    return
  }

  if (batchPlan) {
    if (plan.kind === 'directory' && batchPlan.initialRecords.length === 0) {
      l.warn(`No inputs found in ${resolvedTarget}`)
      return
    }
    if (plan.kind === 'youtube_collection') {
      l.write('info', `Detected YouTube collection URL, processing ${batchPlan.initialRecords.length} videos`)
    }
    await executeBatchPlan(command, effectiveOpts, batchPlan)
    return
  }

  await handleSingleTarget(resolvedTarget, command, effectiveOpts, singleEstimate)
}
