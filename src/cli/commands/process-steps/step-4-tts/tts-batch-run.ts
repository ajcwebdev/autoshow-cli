import { rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { createGenerationOutputDir } from '~/cli/commands/process-steps/generation-command-utils'
import { createPipelineItemFromRecord, readManifest, updateManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { getPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { assertCompatibleTtsDirectoryBatch, priceExistingTtsDirectoryBatch, resumeExistingTtsDirectoryBatch } from '~/cli/commands/setup-and-utilities/resume/generation/tts-batch-resume'
import { buildPipelineItemRecord } from '~/cli/commands/process-steps/step-0-metadata/metadata-batch/pipeline-item-record-builder'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { logBatchCompletionTable, logBatchItemStatus } from '~/cli/commands/process-steps/step-1-download/download-targets/download-batch/download-batch-summary'
import { collectTextInputFiles } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import type {
  AggregatedPriceEstimate,
  CompletedTtsBatchItem,
  HostedTtsSchedulerTelemetry,
  PipelineItemRecord,
  PipelineProviderState,
  PreparedTtsInput,
  PreparedTtsRun,
  StandaloneTtsCommandOptions,
  Step4Metadata,
  SuccessfulTtsBatchItem,
  TtsBatchItemAccumulator,
  TtsBatchLifecycleCoordinator,
  TtsBatchPlanItem,
  TtsDialoguePlanArtifactRef,
  TtsExecutionReadinessObservation,
  TtsOptions,
  TtsTarget,
} from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { formatDuration } from '~/utils/app-logger/formatters'
import { createHumanTable, logLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { validateTtsRenderInputsForTargets } from './run-tts'
import { computeSuccessfulTtsBatchActualCost } from './tts-batch-summary'
import { collectTtsTargets, getTtsArtifactFileName, mergeTtsExecutionReadinessObservations, validateTtsTargetsForExecution } from './tts-targets'
import { createHostedTtsBatchCoordinator } from './tts-utils/hosted-tts-chunk-scheduler'
import { materializeStandaloneMistralReference } from './voice-assets/standalone-mistral-reference'
import { hasMistralProtectedReferences } from './voice-assets/mistral-protected-reference-binding'
import { appendCurrentTtsProviderState } from './script-to-audio/current-render-artifacts'
import { createBatchItemTtsSourceIdentity, createGenericTtsDialoguePlan, createSingleTurnTtsDialoguePlan } from './script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from './script-to-audio/item-dialogue-plan-artifact'
import { buildTtsEstimateForInput, enforceTtsBatchBudget, mergeActualCostBreakdowns, mergeEstimatedCostBreakdowns, mergeTimingBreakdowns, reportTtsBatchEstimates } from './tts-batch-estimates'
import { buildTtsBatchSource, createTtsBatchAccumulators, createTtsBatchPlanItems, getInputStem, getTtsBatchAudioFileName } from './tts-batch-plan'
import { orderedTtsProviderStates, prepareTtsInput, reduceTtsProviderStates, requestedTtsProviders, synthesizePreparedTtsInputForTargets, writeInitialTtsManifest } from './tts-single-run'

const buildTtsBatchInitialRecords = (
  preparedInputs: PreparedTtsInput[],
  targets: TtsTarget[],
  accumulators: TtsBatchItemAccumulator[]
): PipelineItemRecord[] =>
  preparedInputs.map((prepared, index) => {
    const accumulator = accumulators[index]
    if (!accumulator) throw CLIUsageError(`Missing TTS batch lifecycle accumulator for item ${index + 1}.`)
    const providerStates = orderedTtsProviderStates(targets, accumulator.providerStates)
    return {
      ...buildPipelineItemRecord(prepared.manifestInputPath),
      input: prepared.manifestInputPath,
      inputKind: 'text',
      characterCount: prepared.ttsCharacterCount,
      completionStatus: reduceTtsProviderStates(providerStates),
      requestedProviders: requestedTtsProviders(targets),
      providerStates
    }
  })

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
        provider: provider.laneKey ?? provider.provider,
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

const createTtsBatchLifecycleCoordinator = (options: {
  batchDir: string
  createdAt: string
  preparedInputs: PreparedTtsInput[]
  dialoguePlanArtifacts: TtsDialoguePlanArtifactRef[]
  targets: TtsTarget[]
  accumulators: TtsBatchItemAccumulator[]
  source: Record<string, unknown>
}): TtsBatchLifecycleCoordinator => {
  let initialized = false
  let initializationError: unknown
  let initialization: Promise<void> | undefined
  let releasePreparationBarrier = (): void => {}
  const preparationBarrier = new Promise<void>((resolve) => {
    releasePreparationBarrier = resolve
  })

  const allItemsPrepared = (): boolean => options.accumulators.every((accumulator) =>
    options.targets.every((target) => target.targetKey !== undefined && accumulator.providerStates.has(target.targetKey))
  )

  const initializeIfComplete = (): void => {
    if (initialized || initialization || initializationError !== undefined || !allItemsPrepared()) return
    initialization = (async () => {
      const records = buildTtsBatchInitialRecords(options.preparedInputs, options.targets, options.accumulators)
      await writeInitialTtsManifest(options.batchDir, 'batch', records, options.createdAt, options.source)
      initialized = true
    })().catch((error: unknown) => {
      initializationError = error
    }).finally(() => {
      releasePreparationBarrier()
    })
  }

  const waitForInitialization = async (): Promise<void> => {
    initializeIfComplete()
    if (!initialized) await preparationBarrier
    if (initialization) await initialization
    if (initializationError !== undefined) throw initializationError
    if (!initialized) throw CLIUsageError('TTS batch preparation ended before every requested target had a real durable lifecycle state.')
  }

  return {
    beforeDispatch: async (itemIndex, preparedStates) => {
      const accumulator = options.accumulators[itemIndex]
      if (!accumulator) throw CLIUsageError(`Missing TTS batch lifecycle accumulator for item ${itemIndex + 1}.`)
      const dialoguePlanArtifact = options.dialoguePlanArtifacts[itemIndex]
      if (!dialoguePlanArtifact) throw CLIUsageError(`Missing canonical dialogue-plan artifact for TTS batch item ${itemIndex + 1}.`)
      for (const unboundState of preparedStates) {
        const state = bindTtsDialoguePlanArtifact(unboundState, dialoguePlanArtifact)
        if (!state.targetKey) throw CLIUsageError('TTS batch lifecycle produced a prepared state without an operation-scoped targetKey.')
        accumulator.providerStates.set(state.targetKey, state)
      }
      await waitForInitialization()
    },
    onProviderState: async (itemIndex, unboundState) => {
      const dialoguePlanArtifact = options.dialoguePlanArtifacts[itemIndex]
      if (!dialoguePlanArtifact) throw CLIUsageError(`Missing canonical dialogue-plan artifact for TTS batch item ${itemIndex + 1}.`)
      const state = bindTtsDialoguePlanArtifact(unboundState, dialoguePlanArtifact)
      if (!state.targetKey) throw CLIUsageError('TTS batch lifecycle produced a provider state without an operation-scoped targetKey.')
      await waitForInitialization()
      const accumulator = options.accumulators[itemIndex]
      if (!accumulator) throw CLIUsageError(`Missing TTS batch lifecycle accumulator for item ${itemIndex + 1}.`)
      let committed: PipelineProviderState | undefined
      await updateManifest(options.batchDir, (manifest) => {
        if (manifest.command !== 'tts' || manifest.scope !== 'batch' || manifest.items.length !== options.preparedInputs.length) {
          throw CLIUsageError('TTS batch lifecycle can update only its complete canonical batch manifest.')
        }
        const item = manifest.items[itemIndex]
        if (!item || item.input !== options.preparedInputs[itemIndex]?.manifestInputPath) {
          throw CLIUsageError(`Canonical TTS batch item ${itemIndex + 1} changed identity during synthesis.`)
        }
        const providerIndex = item.providers.findIndex((provider) => provider.targetKey === state.targetKey)
        const current = item.providers[providerIndex]
        if (!current) throw CLIUsageError(`Canonical TTS batch item ${itemIndex + 1} is missing lifecycle state for ${state.targetKey}.`)
        committed = appendCurrentTtsProviderState(current, state)
        const providers = item.providers.slice()
        providers[providerIndex] = committed
        const items = manifest.items.slice()
        items[itemIndex] = { ...item, providers, status: reduceTtsProviderStates(providers) }
        return { ...manifest, items }
      })
      accumulator.providerStates.set(state.targetKey, committed as PipelineProviderState)
    },
    abortPreparation: (error) => {
      if (initialized || initializationError !== undefined) return
      initializationError = error
      releasePreparationBarrier()
    }
  }
}

const runTtsBatchPlanForTargets = async (
  plan: TtsBatchPlanItem,
  accumulator: TtsBatchItemAccumulator,
  batchDir: string,
  ttsOptions: TtsOptions,
  targets: TtsTarget[],
  allTargets: TtsTarget[],
  executionReadiness: readonly TtsExecutionReadinessObservation[],
  preflightEstimate: AggregatedPriceEstimate,
  lifecycleCoordinator: TtsBatchLifecycleCoordinator
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
      preflightEstimate,
      {
        artifactOutputDir: batchDir,
        artifactRoot: `items/${accumulator.itemStem}/providers`,
        executionReadiness,
        resolveReportedOutput: (target) => {
          const fileName = getTtsBatchAudioFileName(
            accumulator.itemStem,
            {
              ttsService: target.service,
              ttsModel: target.model,
              audioFileName: getTtsArtifactFileName(target, allTargets.length === 1)
            },
            allTargets.length === 1
          )
          return { path: join(batchDir, fileName), fileName }
        },
        beforeDispatch: async (preparedStates) => await lifecycleCoordinator.beforeDispatch(plan.index, preparedStates),
        onProviderState: async (state) => await lifecycleCoordinator.onProviderState(plan.index, state)
      }
    )
    const metadata = run.metadata
    run.cost.estimated = run.cost.observedEstimate
    accumulator.metadata.push(...metadata)
    accumulator.runs.push(run)
  } catch (error) {
    lifecycleCoordinator.abortPreparation(error)
    accumulator.errors.push(error instanceof Error ? error.message : String(error))
  }
}

export const runTtsDirectoryBatch = async (
  inputPath: string,
  ttsOptions: StandaloneTtsCommandOptions,
  targets: TtsTarget[],
  maxCents: number | undefined
): Promise<void> => {
  const inputFiles = await collectTextInputFiles(inputPath)
  if (inputFiles.length === 0) {
    l.warn(`No .md or .txt files found in ${inputPath}`, { category: 'tts', metadata: { inputPath } })
    return
  }

  const pinnedDir = getPinnedRunDir()
  if (pinnedDir) {
    const existing = await readManifest(pinnedDir)
    if (existing?.command === 'tts' && existing.scope === 'batch') {
      await assertCompatibleTtsDirectoryBatch(pinnedDir, existing, inputFiles, targets)
      const estimate = await priceExistingTtsDirectoryBatch(pinnedDir, ttsOptions)
      if (ttsOptions.price) {
        l.report.estimate(estimate)
        return
      }
      enforceTtsBatchBudget(estimate.totalEstimatedCost, maxCents, ttsOptions.allowOverBudget)
      await createGenerationOutputDir(getInputStem(inputPath))
      await resumeExistingTtsDirectoryBatch(pinnedDir, ttsOptions)
      return
    }
  }

  const createdAt = new Date().toISOString()

  const preparedInputs = await Promise.all(inputFiles.map(async (file, index) => {
    const prepared = await prepareTtsInput(file, ttsOptions, createdAt)
    const sourceIdentity = await createBatchItemTtsSourceIdentity(inputPath, index, prepared.sourceBytes)
    return {
      ...prepared,
      sourceIdentity,
      dialoguePlan: prepared.dialogueRequested
        ? createGenericTtsDialoguePlan(sourceIdentity, prepared.text, ttsOptions, createdAt)
        : createSingleTurnTtsDialoguePlan(sourceIdentity, prepared.text, createdAt)
    }
  }))
  const concurrency = Math.max(1, ttsOptions.batchConcurrency ?? DEFAULT_CLI_CONCURRENCY)
  for (const prepared of preparedInputs) validateTtsRenderInputsForTargets(targets, prepared.text, ttsOptions, prepared)
  const shouldLogEstimates = ttsOptions.price || maxCents !== undefined
  const estimateReport = await reportTtsBatchEstimates(preparedInputs, ttsOptions, targets, shouldLogEstimates, concurrency)
  enforceTtsBatchBudget(estimateReport.totalEstimatedCost, maxCents, ttsOptions.allowOverBudget)

  if (ttsOptions.price) {
    return
  }

  let executionReadiness = await validateTtsTargetsForExecution(targets)
  const hasProtectedMistralReference = hasMistralProtectedReferences(ttsOptions)
  if (executionReadiness.every((entry) => entry.status === 'ready')) {
    ttsOptions = await materializeStandaloneMistralReference(ttsOptions)
    if (hasProtectedMistralReference) {
      targets = collectTtsTargets(ttsOptions)
      executionReadiness = mergeTtsExecutionReadinessObservations(
        executionReadiness,
        await validateTtsTargetsForExecution(targets)
      )
    }
  }
  const batchDir = await createGenerationOutputDir(getInputStem(inputPath))
  const dialoguePlanArtifacts = await Promise.all(preparedInputs.map(async (prepared) =>
    await materializeTtsDialoguePlanArtifact(batchDir, prepared.dialoguePlan)
  ))
  const batchSource = {
    sourceKind: 'directory',
    sourceUrl: inputPath,
    title: getInputStem(inputPath),
    selectedCount: preparedInputs.length
  }
  const plans = await createTtsBatchPlanItems(batchDir, preparedInputs, targets)
  const accumulators = createTtsBatchAccumulators(plans)
  const lifecycleCoordinator = createTtsBatchLifecycleCoordinator({
    batchDir,
    createdAt,
    preparedInputs,
    dialoguePlanArtifacts,
    targets,
    accumulators,
    source: batchSource
  })
  logLocationsTable(l, [{ artifact: 'manifest', path: `${batchDir}/manifest.json` }])

  if (concurrency > 1) {
    l.write('info', `Processing ${preparedInputs.length} TTS inputs with local/file concurrency ${concurrency}`, {
    category: 'tts',
    metadata: { inputCount: preparedInputs.length, concurrency }
  })
  }

  let ok = 0
  let partial = 0
  let fail = 0
  const successfulItems: SuccessfulTtsBatchItem[] = []
  const completedItems: CompletedTtsBatchItem[] = []
  let schedulerTelemetry: HostedTtsSchedulerTelemetry | undefined

  const batchStartedAt = Date.now()

  for (const plan of plans) {
    logBatchItemStatus('info', plan.prepared.inputPath, 'processing')
  }

  const runPromises: Promise<void>[] = []
  const hostedCoordinator = targets.length > 0
    ? createHostedTtsBatchCoordinator({
        maxConcurrency: ttsOptions.ttsChunkConcurrency,
        concurrencyMode: ttsOptions.concurrencyMode,
        hostedConcurrencyCoordinator: ttsOptions.hostedConcurrencyCoordinator
      })
    : undefined
  if (hostedCoordinator) {
    const hostedOptions: TtsOptions = {
      ...ttsOptions,
      hostedTtsChunkScheduler: hostedCoordinator,
      ttsProviderConcurrency: Math.max(targets.length, ttsOptions.ttsProviderConcurrency ?? 1)
    }
    for (const plan of plans) {
      runPromises.push(
        runWithLogContext({ batchId: basename(batchDir), itemIndex: plan.index + 1, itemCount: preparedInputs.length }, async () =>
          await runTtsBatchPlanForTargets(
            plan,
            accumulators[plan.index] as TtsBatchItemAccumulator,
            batchDir,
            hostedOptions,
            targets,
            targets,
            executionReadiness,
            estimateReport.estimates[plan.index] ?? await buildTtsEstimateForInput(plan.prepared, ttsOptions),
            lifecycleCoordinator
          )
        )
      )
    }
  }

  if (hostedCoordinator) {
    const expectedHostedJobs = countExpectedHostedChunkJobs(plans, targets)
    const registeredAllJobs = expectedHostedJobs === 0
      ? true
      : await hostedCoordinator.waitForRegisteredJobs(expectedHostedJobs, 1_000)
    if (!registeredAllJobs) {
      l.debug(`Hosted TTS scheduler registered ${hostedCoordinator.getRegisteredJobCount()}/${expectedHostedJobs} expected chunk jobs before release`, {
        category: 'tts',
        metadata: { registeredJobs: hostedCoordinator.getRegisteredJobCount(), expectedHostedJobs }
      })
    }
    hostedCoordinator.start()
  }

  await Promise.all(runPromises)
  if (hostedCoordinator) {
    schedulerTelemetry = hostedCoordinator.getTelemetry()
    logHostedTtsSchedulerSummary(schedulerTelemetry)
  }

  const finalRecords = buildTtsBatchInitialRecords(preparedInputs, targets, accumulators)
  for (const accumulator of accumulators) {
    const metadata = sortTtsMetadataByTargetOrder(accumulator.metadata, targets)
    const errors = accumulator.errors.map((message) => ({ message }))
    if (metadata.length === 0) {
      fail++
      const failureMessage = accumulator.errors.join('; ') || 'No providers completed'
      finalRecords[accumulator.index] = {
        ...(finalRecords[accumulator.index] ?? {}),
        audioStem: accumulator.itemStem,
        completionStatus: 'failed',
        providerStates: orderedTtsProviderStates(targets, accumulator.providerStates),
        ...(errors.length > 0 ? { errors } : {})
      }
      logBatchItemStatus('error', accumulator.inputPath, 'failed', failureMessage)
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
      providerStates: orderedTtsProviderStates(targets, accumulator.providerStates),
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
  await updateManifest(batchDir, (manifest) => {
    if (manifest.command !== 'tts' || manifest.scope !== 'batch' || manifest.items.length !== finalRecords.length) {
      throw CLIUsageError('TTS batch completion can update only its complete canonical batch manifest.')
    }
    const items = finalRecords.map((record, index) => {
      const next = createPipelineItemFromRecord(batchDir, record)
      const current = manifest.items[index]
      if (!current || current.input !== next.input) {
        throw CLIUsageError(`Canonical TTS batch item ${index + 1} changed identity before completion.`)
      }
      return next
    })
    return { ...manifest, source: completedBatchSource, items }
  })
  logBatchCompletionTable(ok, partial, 0, fail)
  l.report.complete(batchDir, {
    manifest: 'manifest.json',
    ...Object.fromEntries(
      completedItems.flatMap((item) =>
        item.metadata.flatMap((entry) => [
          [
            `audio-${item.itemStem}-${entry.ttsService}-${sanitizeTitleSlug(entry.ttsModel, 120)}`,
            entry.audioFileName
          ],
          ...(entry.artifactDir
            ? [[
                `render-${item.itemStem}-${entry.ttsService}-${sanitizeTitleSlug(entry.ttsModel, 120)}`,
                entry.artifactDir
              ]]
            : [])
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

  await Promise.all(plans.map(async (plan, index) => {
    const accumulator = accumulators[index]
    if (accumulator && accumulator.errors.length === 0 && accumulator.metadata.length === targets.length) {
      await rm(plan.workspaceDir, { recursive: true, force: true })
    }
  }))

  if (ok === 0 && fail > 0) {
    throw InfraError(`TTS batch processing failed for ${fail} item(s)`, { stage: 'tts:batch' })
  }
}
