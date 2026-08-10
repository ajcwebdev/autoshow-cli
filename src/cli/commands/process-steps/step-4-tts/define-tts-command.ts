import { mkdtemp, rename, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import { writePipelineItemRecords } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildPipelineItemRecord } from '~/cli/commands/process-steps/step-0-metadata/metadata-batch/pipeline-item-record-builder'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { logBatchCompletionTable, logBatchItemStatus } from '~/cli/commands/process-steps/step-1-download/download-targets/download-batch/download-batch-summary'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { logSuitePriceSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/suite-price-logging'
import { collectTextInputFiles, isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { ttsCommandFlags } from '~/cli/flags/tts-flags'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { assertNoVoiceIdentityWithDialogue, normalizeGenericTtsOptionFlags } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { defineCliCommand } from '~/cli/native/native-types'
import type { ActualCostBreakdown, AggregatedPriceEstimate, CompletedTtsBatchItem, EstimatedCostBreakdown, HostedTtsSchedulerTelemetry, PipelineItemRecord, PreparedTtsInput, PreparedTtsRun, Step4Metadata, StepTimingBreakdown, SuccessfulTtsBatchItem, TtsBatchEstimateReport, TtsBatchItemAccumulator, TtsBatchPlanItem, TtsOptions, TtsTarget } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { formatDuration, formatEstimatedCostWithExactCents } from '~/utils/app-logger/formatters'
import { createDetailTable, createHumanTable, logLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { buildTtsEstimates } from '~/utils/pricing/aggregate-pricing/tts-estimates'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { evaluatePreflightEstimate } from '~/utils/pricing/preflight'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { assertDialogueFormatIsUsable, isMultiSpeakerRequested, normalizeDialogueFromOptions } from './dialogue-normalizer'
import { runTtsForTargets } from './run-tts'
import { buildTtsBatchEstimateSummary, computeSuccessfulTtsBatchActualCost } from './tts-batch-summary'
import { buildEstimatedTtsTargets, buildTtsArtifactMap, collectTtsTargets, getTtsArtifactFileName } from './tts-targets'
import { createHostedTtsBatchCoordinator } from './tts-utils/hosted-tts-chunk-scheduler'

const formatCents = (amount: number): string => `${amount.toFixed(3)}¢`

type StandaloneTtsCommandOptions = TtsOptions & {
  batchConcurrency: number
  price: boolean
  allowOverBudget: boolean
}

const getTtsInputKind = async (inputPath: string): Promise<'file' | 'directory'> => {
  try {
    const stats = await stat(inputPath)
    if (stats.isDirectory()) {
      return 'directory'
    }
    if (stats.isFile()) {
      return 'file'
    }
  } catch (error) {
    const code = error !== null && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined
    if (code === 'ENOENT') {
      throw CLIUsageError(`File not found: ${inputPath}`)
    }
    throw error
  }

  throw CLIUsageError(`tts input must be a file or directory. Got: ${inputPath}`)
}

const getInputStem = (inputPath: string): string =>
  basename(inputPath, extname(inputPath)) || 'tts'

const prepareTtsInput = async (
  inputPath: string,
  ttsOptions: TtsOptions
): Promise<PreparedTtsInput> => {
  const text = await Bun.file(inputPath).text()
  if (!text.trim()) {
    throw CLIUsageError(`Input file is empty: ${inputPath}`)
  }

  const dialogueRequested = isMultiSpeakerRequested(ttsOptions)
  const dialoguePreview = dialogueRequested ? normalizeDialogueFromOptions(text, ttsOptions) : undefined

  return {
    inputPath,
    text,
    ttsCharacterCount: dialoguePreview?.spokenCharacterCount ?? text.length,
    ttsTimingInputText: dialoguePreview
      ? dialoguePreview.turns.map((turn) => turn.text).join('\n')
      : text,
    dialogueRequested,
    ...(dialoguePreview ? { dialogueTurnCount: dialoguePreview.turns.length } : {})
  }
}

const buildTtsEstimateForInput = async (
  prepared: PreparedTtsInput,
  ttsOptions: TtsOptions
): Promise<AggregatedPriceEstimate> => {
  const steps = await buildTtsEstimates(ttsOptions, prepared.ttsCharacterCount)
  return aggregateExplicitPriceEstimate(steps, ttsOptions, {
    ttsTimingCharacterCount: prepared.ttsCharacterCount,
    ttsInputText: prepared.ttsTimingInputText
  })
}

const reportTtsBatchEstimates = async (
  preparedInputs: PreparedTtsInput[],
  ttsOptions: TtsOptions,
  targets: TtsTarget[],
  logItems: boolean,
  batchConcurrency: number
): Promise<TtsBatchEstimateReport> => {
  const estimates: AggregatedPriceEstimate[] = []

  for (const prepared of preparedInputs) {
    if (logItems) {
      l.write('info', 'TTS Price Item', {
        category: 'pricing',
        humanTable: createDetailTable([
          ['input', prepared.inputPath],
          ['characters', prepared.ttsCharacterCount]
        ]),
        metadata: {
          input: prepared.inputPath,
          characters: prepared.ttsCharacterCount
        }
      })
    }

    const estimate = await buildTtsEstimateForInput(prepared, ttsOptions)
    estimates.push(estimate)

    if (logItems) {
      l.report.estimate(estimate)
    }
  }

  const summary = buildTtsBatchEstimateSummary(estimates, batchConcurrency, ttsOptions.ttsChunkConcurrency, {
    preparedInputs,
    targets
  })
  l.write('info', 'TTS Batch Estimate', {
    category: 'pricing',
    humanTable: createDetailTable([
      ['inputs', summary.inputCount],
      ['batchConcurrency', summary.batchConcurrency],
      ['ttsChunkConcurrency', summary.ttsChunkConcurrency],
      ['totalEstimatedProcessingTime', formatDuration(summary.totalEstimatedProcessingTimeMs)],
      ['estimatedWallTime', formatDuration(summary.estimatedWallTimeMs)],
      ['totalEstimatedCost', formatEstimatedCostWithExactCents(summary.totalEstimatedCost)]
    ]),
    metadata: summary
  })

  if (logItems) {
    logSuitePriceSummary(l, {
      checkedLabel: preparedInputs.length === 1 ? 'TTS input' : 'TTS inputs',
      checkedCount: preparedInputs.length,
      totalEstimatedCost: summary.totalEstimatedCost
    })
  }

  return { estimates, totalEstimatedCost: summary.totalEstimatedCost, summary }
}

const enforceTtsBatchBudget = (
  totalEstimatedCost: number,
  maxCents: number | undefined,
  allowOverBudget: boolean
): void => {
  if (maxCents === undefined || totalEstimatedCost <= maxCents) {
    return
  }

  if (!allowOverBudget) {
    throw CLIUsageError(
      `Estimated suite cost ${formatCents(totalEstimatedCost)} exceeds configured budget ${formatCents(maxCents)}. Use --allow-over-budget to proceed.`
    )
  }

  l.warn(`Estimated suite cost ${formatCents(totalEstimatedCost)} exceeds budget ${formatCents(maxCents)} - continuing because --allow-over-budget is set.`)
}

const runPreparedTtsInput = async (
  prepared: PreparedTtsInput,
  outputDir: string,
  ttsOptions: TtsOptions,
  targets: TtsTarget[],
  preflightEstimate: AggregatedPriceEstimate
): Promise<Step4Metadata[]> => {
  const run = await synthesizePreparedTtsInput(prepared, outputDir, ttsOptions, targets, preflightEstimate)

  await writeGenerationMetadata(outputDir, 'tts', run.metadata, run.cost, run.timing, {
    input: prepared.text,
    requestedProviders: targets.map((t) => ({ service: t.service, model: t.model })),
    completedProviders: run.metadata.map((entry) => ({ service: entry.ttsService, model: entry.ttsModel }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildTtsArtifactMap(run.metadata, 'audio'),
      ...(prepared.dialogueRequested ? { dialogue: 'dialogue-normalized.txt', segments: 'segments/' } : {}),
      manifest: 'manifest.json'
    },
    {
      steps: buildProviderStepSummaries(
        'TTS',
        'tts',
        run.metadata,
        run.cost.actual.steps,
        (entry) => `${entry.ttsService}/${entry.ttsModel}`,
        (entry) => entry.processingTime
      ),
      totalTimeMs: run.metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: run.cost.actual.totalCost,
      includeOutputDir: false
    }
  )

  return run.metadata
}

const synthesizePreparedTtsInput = async (
  prepared: PreparedTtsInput,
  outputDir: string,
  ttsOptions: TtsOptions,
  targets: TtsTarget[],
  preflightEstimate: AggregatedPriceEstimate
): Promise<PreparedTtsRun> => {
  return await synthesizePreparedTtsInputForTargets(prepared, outputDir, ttsOptions, targets, preflightEstimate)
}

const synthesizePreparedTtsInputForTargets = async (
  prepared: PreparedTtsInput,
  outputDir: string,
  ttsOptions: TtsOptions,
  targets: TtsTarget[],
  preflightEstimate: AggregatedPriceEstimate
): Promise<PreparedTtsRun> => {
  const { metadata } = await runWithLogContext({ step: 'step-4-tts' }, async () =>
    await runTtsForTargets(prepared.text, outputDir, ttsOptions, targets)
  )

  const estimatedTtsTargets = buildEstimatedTtsTargets(targets)
  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    ttsTargets: estimatedTtsTargets,
    ttsCharacterCount: prepared.ttsCharacterCount
  })
  const actual = computeActualCosts({
    step4: metadata,
    ttsCharacterCount: prepared.ttsCharacterCount
  })
  const cost = {
    estimated: preflightToEstimated(preflightEstimate),
    observedEstimate,
    actual
  }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      ttsTargets: estimatedTtsTargets,
      ttsCharacterCount: prepared.ttsCharacterCount,
      ttsInputText: prepared.ttsTimingInputText,
      ttsChunkConcurrency: ttsOptions.ttsChunkConcurrency,
    }),
    actual: computeActualProcessingTimes({
      step4: metadata,
      ttsCharacterCount: prepared.ttsCharacterCount,
    }),
  }

  return { metadata, cost, timing }
}

const runSingleTtsInput = async (
  inputPath: string,
  ttsOptions: StandaloneTtsCommandOptions,
  targets: TtsTarget[],
  maxCents: number | undefined
): Promise<void> => {
  if (!isTextInputPath(inputPath)) {
    throw CLIUsageError(`tts only accepts .md or .txt files. Got: ${inputPath}`)
  }

  const prepared = await prepareTtsInput(inputPath, ttsOptions)
  const { estimate: preflightEstimate, shouldExit } = evaluatePreflightEstimate(
    await buildTtsEstimateForInput(prepared, ttsOptions),
    ttsOptions,
    maxCents
  )
  if (shouldExit) {
    l.report.expectedOutput(
      getGenerationExpectedOutputDir('./output/<timestamp>_<label>/'),
      prepared.dialogueRequested
        ? ['dialogue-normalized.txt', 'segments/', 'speech.wav', 'manifest.json']
        : [...targets.map((target) => getTtsArtifactFileName(target, targets.length === 1)), 'manifest.json']
    )
    return
  }

  const outputDir = await createGenerationOutputDir(getInputStem(inputPath))
  await runPreparedTtsInput(prepared, outputDir, ttsOptions, targets, preflightEstimate)
}

const buildTtsBatchInitialRecords = (
  preparedInputs: PreparedTtsInput[]
): PipelineItemRecord[] =>
  preparedInputs.map((prepared) => ({
    ...buildPipelineItemRecord(prepared.inputPath),
    input: prepared.inputPath,
    inputKind: 'text',
    characterCount: prepared.ttsCharacterCount
  }))

const buildTtsBatchItemStem = (inputPath: string, fallbackLabel: string): string => {
  const slug = sanitizeTitleSlug(getInputStem(inputPath), 180)
  return slug.length > 0 ? slug : fallbackLabel
}

export const getTtsBatchAudioFileName = (
  itemStem: string,
  metadata: Pick<Step4Metadata, 'ttsService' | 'ttsModel' | 'audioFileName'>,
  singleTarget: boolean
): string => {
  const extension = extname(metadata.audioFileName) || '.wav'
  if (singleTarget) {
    return `${itemStem}${extension}`
  }

  const providerArtifact = getTtsArtifactFileName(metadata, false)
  return providerArtifact.startsWith('speech')
    ? `${itemStem}${providerArtifact.slice('speech'.length)}`
    : `${itemStem}-${metadata.ttsService}-${sanitizeTitleSlug(metadata.ttsModel, 120)}${extension}`
}

const targetOutputFileNamesForStem = (
  itemStem: string,
  targets: TtsTarget[]
): string[] => targets.map((target) =>
  getTtsBatchAudioFileName(
    itemStem,
    {
      ttsService: target.service,
      ttsModel: target.model,
      audioFileName: getTtsArtifactFileName(target, targets.length === 1)
    },
    targets.length === 1
  )
)

const reserveTtsBatchItemStem = async (
  batchDir: string,
  preferredStem: string,
  targets: TtsTarget[],
  usedStems: Set<string>
): Promise<string> => {
  for (let counter = 1; ; counter += 1) {
    const candidateStem = counter === 1 ? preferredStem : `${preferredStem}-${counter}`
    if (usedStems.has(candidateStem)) {
      continue
    }

    usedStems.add(candidateStem)
    const candidateFileNames = targetOutputFileNamesForStem(candidateStem, targets)
    const hasExistingFile = (await Promise.all(
      candidateFileNames.map(async (fileName) => await Bun.file(join(batchDir, fileName)).exists())
    )).some((exists) => exists)
    if (hasExistingFile) {
      usedStems.delete(candidateStem)
      continue
    }

    return candidateStem
  }
}

const moveTtsBatchAudioFiles = async (
  workspaceDir: string,
  batchDir: string,
  itemStem: string,
  metadata: Step4Metadata[],
  singleTarget: boolean
): Promise<Step4Metadata[]> => {
  const moved: Step4Metadata[] = []

  for (const entry of metadata) {
    const fileName = getTtsBatchAudioFileName(itemStem, entry, singleTarget)
    const sourcePath = join(workspaceDir, entry.audioFileName)
    const finalPath = join(batchDir, fileName)
    await rename(sourcePath, finalPath)
    moved.push({
      ...entry,
      audioFileName: fileName,
      audioFileSize: Bun.file(finalPath).size
    })
  }

  return moved
}

const mergeEstimatedCostBreakdowns = (
  breakdowns: EstimatedCostBreakdown[]
): EstimatedCostBreakdown => ({
  totalCost: breakdowns.reduce((sum, breakdown) => sum + breakdown.totalCost, 0),
  steps: breakdowns.flatMap((breakdown) => breakdown.steps)
})

const mergeActualCostBreakdowns = (
  breakdowns: ActualCostBreakdown[]
): ActualCostBreakdown => ({
  totalCost: breakdowns.reduce((sum, breakdown) => sum + breakdown.totalCost, 0),
  steps: breakdowns.flatMap((breakdown) => breakdown.steps)
})

const mergeTimingBreakdowns = (
  breakdowns: StepTimingBreakdown[]
): StepTimingBreakdown => ({
  totalProcessingTimeMs: breakdowns.reduce((sum, breakdown) => sum + breakdown.totalProcessingTimeMs, 0),
  steps: breakdowns.flatMap((breakdown) => breakdown.steps)
})

export const buildTtsBatchSource = (
  items: CompletedTtsBatchItem[],
  batchSource: Record<string, unknown>,
  batchSummary: {
    ok: number
    partial: number
    fail: number
    wallTimeMs: number
    requestedProviders: Array<{ service: string, model: string }>
  },
  schedulerTelemetry?: HostedTtsSchedulerTelemetry | undefined
): Record<string, unknown> => {
  const runs = items.map((item) => item.run)

  return {
    ...batchSource,
    summary: {
      ok: batchSummary.ok,
      partial: batchSummary.partial,
      fail: batchSummary.fail,
      processingTime: batchSummary.wallTimeMs,
      cost: {
        estimated: mergeEstimatedCostBreakdowns(runs.map((run) => run.cost.estimated)),
        observedEstimate: mergeEstimatedCostBreakdowns(runs.map((run) => run.cost.observedEstimate)),
        actual: mergeActualCostBreakdowns(runs.map((run) => run.cost.actual))
      },
      timing: {
        estimated: mergeTimingBreakdowns(runs.map((run) => run.timing.estimated)),
        actual: mergeTimingBreakdowns(runs.map((run) => run.timing.actual))
      },
      requestedProviders: batchSummary.requestedProviders,
      ...(schedulerTelemetry ? { hostedTtsScheduler: schedulerTelemetry } : {})
    }
  }
}

const getTargetOrderKey = (
  target: Pick<TtsTarget, 'service' | 'model'> | Pick<Step4Metadata, 'ttsService' | 'ttsModel'>
): string =>
  'service' in target
    ? `${target.service}\0${target.model}`
    : `${target.ttsService}\0${target.ttsModel}`

const sortTtsMetadataByTargetOrder = (
  metadata: Step4Metadata[],
  targets: TtsTarget[]
): Step4Metadata[] => {
  const orderByKey = new Map<string, number>()
  targets.forEach((target, index) => {
    const key = getTargetOrderKey(target)
    if (!orderByKey.has(key)) {
      orderByKey.set(key, index)
    }
  })
  return metadata.slice().sort((left, right) => {
    const leftOrder = orderByKey.get(getTargetOrderKey(left)) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = orderByKey.get(getTargetOrderKey(right)) ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })
}

const createTtsBatchPlanItems = async (
  batchDir: string,
  preparedInputs: PreparedTtsInput[],
  targets: TtsTarget[]
): Promise<TtsBatchPlanItem[]> => {
  const usedItemStems = new Set<string>()
  const plans: TtsBatchPlanItem[] = []

  for (let index = 0; index < preparedInputs.length; index++) {
    const prepared = preparedInputs[index] as PreparedTtsInput
    const itemStem = await reserveTtsBatchItemStem(
      batchDir,
      buildTtsBatchItemStem(prepared.inputPath, `item-${index + 1}`),
      targets,
      usedItemStems
    )
    plans.push({
      index,
      prepared,
      itemStem,
      workspaceDir: await mkdtemp(join(batchDir, `.tts-${itemStem}-`))
    })
  }

  return plans
}

const createTtsBatchAccumulators = (
  plans: TtsBatchPlanItem[]
): TtsBatchItemAccumulator[] =>
  plans.map((plan) => ({
    index: plan.index,
    inputPath: plan.prepared.inputPath,
    itemStem: plan.itemStem,
    characterCount: plan.prepared.ttsCharacterCount,
    metadata: [],
    runs: [],
    errors: []
  }))

const mergePreparedTtsRuns = (
  runs: PreparedTtsRun[],
  metadata: Step4Metadata[]
): PreparedTtsRun => ({
  metadata,
  cost: {
    estimated: mergeEstimatedCostBreakdowns(runs.map((run) => run.cost.estimated)),
    observedEstimate: mergeEstimatedCostBreakdowns(runs.map((run) => run.cost.observedEstimate)),
    actual: mergeActualCostBreakdowns(runs.map((run) => run.cost.actual))
  },
  timing: {
    estimated: mergeTimingBreakdowns(runs.map((run) => run.timing.estimated)),
    actual: mergeTimingBreakdowns(runs.map((run) => run.timing.actual))
  }
})

const countExpectedHostedChunkJobs = (
  plans: TtsBatchPlanItem[],
  hostedTargets: TtsTarget[]
): number =>
  plans.reduce((sum, plan) =>
    sum + hostedTargets.reduce((targetSum, target) => {
      if (
        plan.prepared.dialogueRequested
        && (target.multiSpeakerStrategy ?? 'segment-and-concat') === 'segment-and-concat'
      ) {
        return targetSum + Math.max(1, plan.prepared.dialogueTurnCount ?? 1)
      }
      return targetSum + 1
    }, 0)
  , 0)

const logHostedTtsSchedulerSummary = (
  telemetry: HostedTtsSchedulerTelemetry | undefined
): void => {
  if (!telemetry || telemetry.providers.length === 0) {
    return
  }

  l.write('info', 'Hosted TTS Scheduler Summary', {
    category: 'general',
    humanTable: createHumanTable(
      telemetry.providers.map((provider) => ({
        provider: provider.provider,
        chunks: `${provider.completedChunks}/${provider.startedChunks}`,
        limit: `${provider.currentLimit}/${provider.maxLimit}`,
        retries: provider.retryCount,
        rateLimits: provider.rateLimitCount,
        queueP95: formatDuration(provider.queueWait.p95Ms),
        activeP95: formatDuration(provider.activeLatency.p95Ms),
        maxActive: provider.maxActive
      })),
      ['provider', 'chunks', 'limit', 'retries', 'rateLimits', 'queueP95', 'activeP95', 'maxActive']
    ),
    metadata: telemetry
  })
}

const runTtsBatchPlanForTargets = async (
  plan: TtsBatchPlanItem,
  accumulator: TtsBatchItemAccumulator,
  batchDir: string,
  ttsOptions: TtsOptions,
  targets: TtsTarget[],
  allTargets: TtsTarget[],
  preflightEstimate: AggregatedPriceEstimate
): Promise<void> => {
  if (targets.length === 0) {
    return
  }

  try {
    const run = await synthesizePreparedTtsInputForTargets(
      plan.prepared,
      plan.workspaceDir,
      ttsOptions,
      targets,
      preflightEstimate
    )
    const metadata = await moveTtsBatchAudioFiles(
      plan.workspaceDir,
      batchDir,
      plan.itemStem,
      run.metadata,
      allTargets.length === 1
    )
    run.metadata = metadata
    run.cost.estimated = run.cost.observedEstimate
    accumulator.metadata.push(...metadata)
    accumulator.runs.push(run)
  } catch (error) {
    accumulator.errors.push(error instanceof Error ? error.message : String(error))
  }
}

const runTtsDirectoryBatch = async (
  inputPath: string,
  ttsOptions: StandaloneTtsCommandOptions,
  targets: TtsTarget[],
  maxCents: number | undefined
): Promise<void> => {
  const inputFiles = await collectTextInputFiles(inputPath)
  if (inputFiles.length === 0) {
    l.warn(`No .md or .txt files found in ${inputPath}`)
    return
  }

  const preparedInputs = await Promise.all(inputFiles.map((file) => prepareTtsInput(file, ttsOptions)))
  const concurrency = Math.max(1, ttsOptions.batchConcurrency ?? DEFAULT_CLI_CONCURRENCY)
  const shouldLogEstimates = ttsOptions.price || maxCents !== undefined
  const estimateReport = await reportTtsBatchEstimates(preparedInputs, ttsOptions, targets, shouldLogEstimates, concurrency)
  enforceTtsBatchBudget(estimateReport.totalEstimatedCost, maxCents, ttsOptions.allowOverBudget)

  if (ttsOptions.price) {
    return
  }

  const batchDir = await createGenerationOutputDir(getInputStem(inputPath))
  const batchSource = {
    sourceKind: 'directory',
    sourceUrl: inputPath,
    title: getInputStem(inputPath),
    selectedCount: preparedInputs.length
  }
  const finalRecords = buildTtsBatchInitialRecords(preparedInputs)
  await writePipelineItemRecords(batchDir, 'tts', 'batch', finalRecords, { source: batchSource })
  logLocationsTable(l, [{ artifact: 'manifest', path: `${batchDir}/manifest.json` }])

  if (concurrency > 1) {
    l.write('info', `Processing ${preparedInputs.length} TTS inputs with local/file concurrency ${concurrency}`)
  }

  let ok = 0
  let partial = 0
  let fail = 0
  const successfulItems: SuccessfulTtsBatchItem[] = []
  const completedItems: CompletedTtsBatchItem[] = []
  const plans = await createTtsBatchPlanItems(batchDir, preparedInputs, targets)
  const accumulators = createTtsBatchAccumulators(plans)
  const hostedTargets = targets.filter((target) => target.service !== 'kitten')
  const localTargets = targets.filter((target) => target.service === 'kitten')
  let schedulerTelemetry: HostedTtsSchedulerTelemetry | undefined

  const batchStartedAt = Date.now()

  try {
    for (const plan of plans) {
      logBatchItemStatus('info', plan.prepared.inputPath, 'processing')
    }

    if (hostedTargets.length > 0) {
      const hostedCoordinator = createHostedTtsBatchCoordinator(ttsOptions.ttsChunkConcurrency)
      const hostedOptions: TtsOptions = {
        ...ttsOptions,
        hostedTtsChunkScheduler: hostedCoordinator,
        ttsProviderConcurrency: Math.max(hostedTargets.length, ttsOptions.ttsProviderConcurrency ?? 1)
      }
      const expectedHostedJobs = countExpectedHostedChunkJobs(plans, hostedTargets)
      const hostedRuns = plans.map((plan) =>
        runWithLogContext({ batchId: basename(batchDir), itemIndex: plan.index + 1, itemCount: preparedInputs.length }, async () =>
          await runTtsBatchPlanForTargets(
            plan,
            accumulators[plan.index] as TtsBatchItemAccumulator,
            batchDir,
            hostedOptions,
            hostedTargets,
            targets,
            estimateReport.estimates[plan.index] ?? await buildTtsEstimateForInput(plan.prepared, ttsOptions)
          )
        )
      )

      const registeredAllJobs = expectedHostedJobs === 0
        ? true
        : await hostedCoordinator.waitForRegisteredJobs(expectedHostedJobs, 1_000)
      if (!registeredAllJobs) {
        l.debug(`Hosted TTS scheduler registered ${hostedCoordinator.getRegisteredJobCount()}/${expectedHostedJobs} expected chunk jobs before release`)
      }
      hostedCoordinator.start()
      await Promise.all(hostedRuns)
      schedulerTelemetry = hostedCoordinator.getTelemetry()
      logHostedTtsSchedulerSummary(schedulerTelemetry)
    }

    if (localTargets.length > 0) {
      await mapWithConcurrency(concurrency, plans, async (plan) => {
        await runWithLogContext({ batchId: basename(batchDir), itemIndex: plan.index + 1, itemCount: preparedInputs.length }, async () =>
          await runTtsBatchPlanForTargets(
            plan,
            accumulators[plan.index] as TtsBatchItemAccumulator,
            batchDir,
            ttsOptions,
            localTargets,
            targets,
            estimateReport.estimates[plan.index] ?? await buildTtsEstimateForInput(plan.prepared, ttsOptions)
          )
        )
      })
    }
  } finally {
    await Promise.all(plans.map((plan) => rm(plan.workspaceDir, { recursive: true, force: true })))
  }

  for (const accumulator of accumulators) {
    const metadata = sortTtsMetadataByTargetOrder(accumulator.metadata, targets)
    const errors = accumulator.errors.map((message) => ({ message }))
    if (metadata.length === 0) {
      fail++
      finalRecords[accumulator.index] = {
        ...(finalRecords[accumulator.index] ?? {}),
        audioStem: accumulator.itemStem,
        completionStatus: 'failed',
        ...(errors.length > 0 ? { errors } : {})
      }
      logBatchItemStatus('error', accumulator.inputPath, 'failed', accumulator.errors.join('; ') || 'No providers completed')
      continue
    }

    const isPartial = metadata.length < targets.length || accumulator.errors.length > 0
    const run = mergePreparedTtsRuns(accumulator.runs, metadata)
    completedItems.push({
      index: accumulator.index,
      inputPath: accumulator.inputPath,
      itemStem: accumulator.itemStem,
      metadata,
      characterCount: accumulator.characterCount,
      run
    })
    successfulItems.push({
      metadata,
      characterCount: accumulator.characterCount
    })
    ok++
    if (isPartial) {
      partial++
      logBatchItemStatus('warn', accumulator.inputPath, 'incomplete', `${metadata.length}/${targets.length} providers completed`)
    } else {
      logBatchItemStatus('success', accumulator.inputPath, 'done')
    }
    finalRecords[accumulator.index] = {
      ...(finalRecords[accumulator.index] ?? {}),
      audioStem: accumulator.itemStem,
      completionStatus: isPartial ? 'incomplete' : 'full',
      tts: metadata,
      ...(errors.length > 0 ? { errors } : {})
    }
  }

  const actualBatchWallTimeMs = Date.now() - batchStartedAt
  const actualTotalCost = computeSuccessfulTtsBatchActualCost(successfulItems)
  const requestedProviders = targets.map((t) => ({ service: t.service, model: t.model }))

  const completedBatchSource = buildTtsBatchSource(
    completedItems.sort((a, b) => a.index - b.index),
    batchSource,
    {
      ok,
      partial,
      fail,
      wallTimeMs: actualBatchWallTimeMs,
      requestedProviders
    },
    schedulerTelemetry
  )
  await writePipelineItemRecords(batchDir, 'tts', 'batch', finalRecords, { source: completedBatchSource })
  logBatchCompletionTable(ok, partial, 0, fail)
  l.report.complete(batchDir, {
    manifest: 'manifest.json',
    ...Object.fromEntries(
      completedItems.flatMap((item) =>
        item.metadata.map((entry) => [
          `audio-${item.itemStem}-${entry.ttsService}-${sanitizeTitleSlug(entry.ttsModel, 120)}`,
          entry.audioFileName
        ])
      )
    )
  }, {
    summaryMessage: 'TTS Batch Complete',
    totalTimeMs: actualBatchWallTimeMs,
    totalCost: actualTotalCost,
    steps: [],
    includeOutputDir: true
  })

  if (ok === 0 && fail > 0) {
    throw InfraError(`TTS batch processing failed for ${fail} item(s)`, { stage: 'tts:batch' })
  }
}

export const ttsCommand = defineCliCommand({
  name: 'tts',
  description: 'Generate speech audio from a text file or directory of text files (default provider: Kitten TTS)',
  parameters: [{ key: '<input>', description: 'Path to a .md/.txt file or a directory containing text files' }],
  flags: ttsCommandFlags,
  help: {
    examples: [
      ['bun autoshow tts input/examples/tts/1-tts.md --provider kitten=kitten-tts-nano-0.8-int8', 'Generate speech with local Kitten TTS'],
      ['bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3', 'Generate speech with ElevenLabs'],
      ['bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3', 'Clone a voice with ElevenLabs IVC'],
      ['bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator', 'Use a MiniMax voice ID'],
      ['bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3', 'Generate speech with Mistral Voxtral']
    ]
  }
}, async (ctx) => {
  const inputPath = ctx.parameters.input
  const flags = ctx.flags as Record<string, unknown>
  const inputKind = await getTtsInputKind(inputPath)
  const maxCents = await resolveMaxCentsFromFlags(flags)
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    flags,
    ctx.rawParsed.explicitFlags,
    ctx.rawParsed.flagOccurrences,
    'provider',
    STANDALONE_TTS_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-tts', allLocalTarget: 'all-local-tts' }
  )
  const ttsNormalized = normalizeGenericTtsOptionFlags(
    providerNormalized.flags,
    providerNormalized.explicitFlags,
    providerNormalized.flagOccurrences,
    'kitten'
  )
  const ttsOptions: StandaloneTtsCommandOptions = buildOptsFromFlags(
    true,
    ttsNormalized.flags,
    { defaultTtsEngine: 'kitten' },
    ttsNormalized.explicitFlags,
    ttsNormalized.flagOccurrences
  )

  assertDialogueFormatIsUsable(ttsOptions, ttsNormalized.explicitFlags)

  assertNoVoiceIdentityWithDialogue(ttsOptions, ttsNormalized.explicitFlags)

  const targets = collectTtsTargets(ttsOptions)

  if (inputKind === 'directory') {
    await runTtsDirectoryBatch(inputPath, ttsOptions, targets, maxCents)
    return
  }

  await runSingleTtsInput(inputPath, ttsOptions, targets, maxCents)
})
