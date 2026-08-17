import { mkdtemp, rename, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags } from '~/cli/commands/process-steps/generation-command-utils'
import { createManifest, createPipelineItemFromRecord, readManifest, updateManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { getPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { assertCompatibleTtsDirectoryBatch, priceExistingTtsDirectoryBatch, resumeExistingTtsDirectoryBatch } from '~/cli/commands/setup-and-utilities/resume/generation/tts-batch-resume'
import { buildPipelineItemRecord } from '~/cli/commands/process-steps/step-0-metadata/metadata-batch/pipeline-item-record-builder'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { logBatchCompletionTable, logBatchItemStatus } from '~/cli/commands/process-steps/step-1-download/download-targets/download-batch/download-batch-summary'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { resolveStandaloneMistralTtsCliReferenceInput, resolveStandaloneMistralTtsSpeakerReferenceInputs } from '~/cli/options/option-resolution/tts-options'
import { logSuitePriceSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/suite-price-logging'
import { collectTextInputFiles, isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { ttsCommandFlags } from '~/cli/flags/tts-flags'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { assertNoVoiceIdentityWithDialogue, normalizeGenericTtsOptionFlags } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { defineCliCommand } from '~/cli/native/native-types'
import type { ActualCostBreakdown, AggregatedPriceEstimate, CompletedTtsBatchItem, EstimatedCostBreakdown, HostedTtsSchedulerTelemetry, PipelineItemRecord, PipelineProviderState, PreparedTtsInput, PreparedTtsRun, Step4Metadata, StepTimingBreakdown, SuccessfulTtsBatchItem, TtsBatchEstimateReport, TtsBatchItemAccumulator, TtsBatchPlanItem, TtsOptions, TtsTarget } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { formatDuration, formatEstimatedCostWithExactCents } from '~/utils/app-logger/formatters'
import { createDetailTable, createHumanTable, logLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { aggregateExplicitPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { buildTtsEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/tts-estimates'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { evaluatePreflightEstimate } from '~/cli/commands/pricing-orchestration/preflight'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { selectCheapestDefaultHostedTtsSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { assertDialogueFormatIsUsable, isMultiSpeakerRequested, normalizeDialogueFromOptions } from './dialogue-normalizer'
import { runTtsForTargets, validateTtsRenderInputsForTargets } from './run-tts'
import type { TtsRunSourceContext } from './run-tts'
import { buildTtsBatchEstimateSummary, computeSuccessfulTtsBatchActualCost } from './tts-batch-summary'
import { buildEstimatedTtsTargets, buildTtsArtifactMap, collectTtsTargets, getTtsArtifactFileName, mergeTtsExecutionReadinessObservations, validateTtsTargetsForExecution } from './tts-targets'
import type { TtsExecutionReadinessObservation } from './tts-targets'
import { createHostedTtsBatchCoordinator } from './tts-utils/hosted-tts-chunk-scheduler'
import { materializeStandaloneMistralReference, planStandaloneMistralReference, planStandaloneMistralSpeakerReferences } from './voice-assets/standalone-mistral-reference'
import { hasMistralProtectedReferences } from './voice-assets/mistral-protected-reference-binding'
import { appendCurrentTtsProviderState } from './script-to-audio/current-render-artifacts'
import { createBatchItemTtsSourceIdentity, createFileTtsSourceIdentity, createGenericTtsDialoguePlan, createSingleTurnTtsDialoguePlan } from './script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from './script-to-audio/item-dialogue-plan-artifact'
import type { TtsDialoguePlanArtifactRef } from './script-to-audio/item-dialogue-plan-artifact'

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
  ttsOptions: TtsOptions,
  createdAt: string
): Promise<PreparedTtsInput> => {
  const sourceBytes = new Uint8Array(await Bun.file(inputPath).arrayBuffer())
  const text = new TextDecoder().decode(sourceBytes)
  if (!text.trim()) {
    throw CLIUsageError(`Input file is empty: ${inputPath}`)
  }

  const dialogueRequested = isMultiSpeakerRequested(ttsOptions)
  const dialoguePreview = dialogueRequested ? normalizeDialogueFromOptions(text, ttsOptions) : undefined
  const sourceIdentity = await createFileTtsSourceIdentity(inputPath, sourceBytes)
  const dialoguePlan = dialogueRequested
    ? createGenericTtsDialoguePlan(sourceIdentity, text, ttsOptions, createdAt)
    : createSingleTurnTtsDialoguePlan(sourceIdentity, text, createdAt)
  const manifestInputPath = sourceIdentity.sourceLocator.kind === 'file'
    ? sourceIdentity.sourceLocator.canonicalPath
    : inputPath

  return {
    inputPath,
    manifestInputPath,
    sourceBytes,
    text,
    sourceIdentity,
    dialoguePlan,
    ttsCharacterCount: dialoguePreview?.spokenCharacterCount ?? text.length,
    ttsTimingInputText: dialoguePreview
      ? dialoguePreview.turns.map((turn) => turn.text).join('\n')
      : text,
    dialogueRequested,
    ...(dialoguePreview ? { dialogueTurnCount: dialoguePreview.turns.length } : {})
  }
}

const reduceTtsProviderStates = (
  providers: readonly PipelineProviderState[]
): 'full' | 'incomplete' | 'failed' | 'skipped' => {
  if (providers.length === 0) {
    throw CLIUsageError('A canonical TTS item requires every requested target\'s real lifecycle state.')
  }
  if (providers.every((provider) => provider.status === 'skipped')) return 'skipped'
  if (
    providers.some((provider) => provider.status === 'succeeded')
    && providers.every((provider) => provider.status === 'succeeded' || provider.status === 'skipped')
  ) return 'full'
  if (
    providers.some((provider) => provider.status === 'failed')
    && providers.every((provider) => provider.status === 'failed' || provider.status === 'skipped')
  ) return 'failed'
  return 'incomplete'
}

const requestedTtsProviders = (targets: readonly TtsTarget[]) => targets.map((target) => ({
  service: target.service,
  model: target.model,
  local: false,
  operation: target.operation,
  targetKey: target.targetKey,
  transport: target.transport
}))

const orderedTtsProviderStates = (
  targets: readonly TtsTarget[],
  states: ReadonlyMap<string, PipelineProviderState>
): PipelineProviderState[] => targets.map((target) => {
  if (!target.targetKey) {
    throw CLIUsageError(`TTS target ${target.service}/${target.model} is missing its operation-scoped targetKey.`)
  }
  const state = states.get(target.targetKey)
  if (!state) {
    throw CLIUsageError(`TTS lifecycle did not durably prepare ${target.service}/${target.model} before dispatch.`)
  }
  return state
})

const writeInitialTtsManifest = async (
  rootDir: string,
  scope: 'single' | 'batch',
  records: PipelineItemRecord[],
  createdAt: string,
  source?: Record<string, unknown> | undefined
): Promise<void> => {
  const manifest = createManifest(
    'tts',
    scope,
    records.map((record) => createPipelineItemFromRecord(rootDir, record, scope === 'single' ? { outputDir: rootDir } : {})),
    source
  )
  await writeManifest(rootDir, { ...manifest, createdAt, updatedAt: createdAt })
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
  preflightEstimate: AggregatedPriceEstimate,
  createdAt: string,
  executionReadiness: readonly TtsExecutionReadinessObservation[]
): Promise<Step4Metadata[]> => {
  const lifecycleStates = new Map<string, PipelineProviderState>()
  const dialoguePlanArtifact = await materializeTtsDialoguePlanArtifact(outputDir, prepared.dialoguePlan)
  const run = await synthesizePreparedTtsInputForTargets(prepared, outputDir, ttsOptions, targets, preflightEstimate, {
    executionReadiness,
    beforeDispatch: async (preparedStates) => {
      for (const unboundState of preparedStates) {
        const state = bindTtsDialoguePlanArtifact(unboundState, dialoguePlanArtifact)
        if (!state.targetKey) {
          throw CLIUsageError('TTS lifecycle produced a prepared state without an operation-scoped targetKey.')
        }
        lifecycleStates.set(state.targetKey, state)
      }
      const providerStates = orderedTtsProviderStates(targets, lifecycleStates)
      await writeInitialTtsManifest(outputDir, 'single', [{
        ...buildPipelineItemRecord(prepared.manifestInputPath),
        input: prepared.manifestInputPath,
        inputKind: 'text',
        characterCount: prepared.ttsCharacterCount,
        completionStatus: reduceTtsProviderStates(providerStates),
        requestedProviders: requestedTtsProviders(targets),
        providerStates,
        tts: [],
        cost: { estimated: preflightToEstimated(preflightEstimate) }
      }], createdAt)
    },
    onProviderState: async (unboundState) => {
      const state = bindTtsDialoguePlanArtifact(unboundState, dialoguePlanArtifact)
      if (!state.targetKey) {
        throw CLIUsageError('TTS lifecycle produced a provider state without an operation-scoped targetKey.')
      }
      let committed: PipelineProviderState | undefined
      await updateManifest(outputDir, (manifest) => {
        if (manifest.command !== 'tts' || manifest.scope !== 'single' || manifest.items.length !== 1) {
          throw CLIUsageError('TTS lifecycle can update only its canonical single-run manifest.')
        }
        const item = manifest.items[0]
        if (!item) throw CLIUsageError('Canonical single-run TTS manifest is missing its item.')
        const providerIndex = item.providers.findIndex((provider) => provider.targetKey === state.targetKey)
        const current = item.providers[providerIndex]
        if (!current) {
          throw CLIUsageError(`Canonical single-run TTS manifest is missing lifecycle state for ${state.targetKey}.`)
        }
        committed = appendCurrentTtsProviderState(current, state)
        const providers = item.providers.slice()
        providers[providerIndex] = committed
        return {
          ...manifest,
          items: [{ ...item, providers, status: reduceTtsProviderStates(providers) }]
        }
      })
      lifecycleStates.set(state.targetKey, committed as PipelineProviderState)
    }
  })
  await updateManifest(outputDir, (manifest) => {
    if (manifest.command !== 'tts' || manifest.scope !== 'single' || manifest.items.length !== 1) {
      throw CLIUsageError('TTS completion can update only its canonical single-run manifest.')
    }
    const item = manifest.items[0]
    if (!item) throw CLIUsageError('Canonical single-run TTS manifest is missing its item.')
    return {
      ...manifest,
      items: [{
        ...item,
        input: prepared.manifestInputPath,
        status: reduceTtsProviderStates(item.providers),
        metadata: { ...item.metadata, tts: run.metadata, cost: run.cost, timing: run.timing }
      }]
    }
  })

  l.report.complete(
    outputDir,
    {
      ...buildTtsArtifactMap(run.metadata, 'audio'),
      ...Object.fromEntries(run.metadata.flatMap((entry) => entry.artifactDir
        ? [[`render-${entry.ttsService}-${sanitizeTitleSlug(entry.ttsModel, 120)}`, entry.artifactDir]]
        : [])),
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

const synthesizePreparedTtsInputForTargets = async (
  prepared: PreparedTtsInput,
  outputDir: string,
  ttsOptions: TtsOptions,
  targets: TtsTarget[],
  preflightEstimate: AggregatedPriceEstimate,
  lifecycle?: Pick<TtsRunSourceContext, 'artifactOutputDir' | 'artifactRoot' | 'executionReadiness' | 'resolveReportedOutput' | 'beforeDispatch' | 'onProviderState'> | undefined
): Promise<PreparedTtsRun> => {
  const { metadata } = await runWithLogContext({ step: 'step-4-tts' }, async () =>
    await runTtsForTargets(prepared.text, outputDir, ttsOptions, targets, {
      sourceIdentity: prepared.sourceIdentity,
      dialoguePlan: prepared.dialoguePlan,
      ...lifecycle
    })
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
      concurrencyMode: ttsOptions.concurrencyMode,
    }),
    actual: computeActualProcessingTimes({
      step4: metadata,
      ttsCharacterCount: prepared.ttsCharacterCount,
    }),
  }

  return { metadata, cost, timing }
}

export const runSingleTtsInput = async (
  inputPath: string,
  ttsOptions: StandaloneTtsCommandOptions,
  targets: TtsTarget[],
  maxCents: number | undefined
): Promise<void> => {
  if (!isTextInputPath(inputPath)) {
    throw CLIUsageError(`tts only accepts .md or .txt files. Got: ${inputPath}`)
  }

  const createdAt = new Date().toISOString()
  const prepared = await prepareTtsInput(inputPath, ttsOptions, createdAt)
  validateTtsRenderInputsForTargets(targets, prepared.text, ttsOptions, prepared)
  const { estimate: preflightEstimate, shouldExit } = evaluatePreflightEstimate(
    await buildTtsEstimateForInput(prepared, ttsOptions),
    ttsOptions,
    maxCents
  )
  if (shouldExit) {
    l.report.expectedOutput(
      getGenerationExpectedOutputDir('./output/<timestamp>_<label>/'),
      [
        ...targets.map((target) => getTtsArtifactFileName(target, targets.length === 1)),
        ...targets.flatMap((target) => target.targetKey ? [`providers/${target.targetKey}/`] : []),
        'manifest.json'
      ]
    )
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
  const outputDir = await createGenerationOutputDir(getInputStem(inputPath))
  await runPreparedTtsInput(prepared, outputDir, ttsOptions, targets, preflightEstimate, createdAt, executionReadiness)
}

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

export const moveTtsBatchAudioFiles = async (
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
    errors: [],
    providerStates: new Map()
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

type TtsBatchLifecycleCoordinator = {
  beforeDispatch: (itemIndex: number, preparedStates: PipelineProviderState[]) => Promise<void>
  onProviderState: (itemIndex: number, state: PipelineProviderState) => Promise<void>
  abortPreparation: (error: unknown) => void
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
    l.warn(`No .md or .txt files found in ${inputPath}`)
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
    l.write('info', `Processing ${preparedInputs.length} TTS inputs with local/file concurrency ${concurrency}`)
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
        l.debug(`Hosted TTS scheduler registered ${hostedCoordinator.getRegisteredJobCount()}/${expectedHostedJobs} expected chunk jobs before release`)
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

export const ttsCommand = defineCliCommand({
  name: 'tts',
  description: 'Generate speech audio from a text file or directory of text files (default provider: cheapest hosted TTS)',
  parameters: [{ key: '<input>', description: 'Path to a .md/.txt file or a directory containing text files' }],
  flags: ttsCommandFlags,
  help: {
    examples: [
      ['bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3', 'Generate speech with ElevenLabs'],
      ['bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-voice YOUR_EXISTING_VOICE_ID', 'Use an existing ElevenLabs voice'],
      ['bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator', 'Use a MiniMax voice ID'],
      ['bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3', 'Generate speech with Mistral Voxtral'],
      ['bun autoshow tts input/examples/tts/1-tts.md --provider fal=fal-ai/bytedance/seed-speech/tts/v2 --tts-voice stokie_en', 'Generate speech with fal.ai Seed Speech']
    ]
  }
}, async (ctx) => {
  const inputPath = ctx.parameters.input
  const rawFlags = ctx.flags as Record<string, unknown>
  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const configPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(configPath)
  const flags = mergeConfigIntoRawFlags(rawFlags, config, ctx.rawParsed.explicitFlags)
  const inputKind = await getTtsInputKind(inputPath)
  const maxCents = await resolveMaxCentsFromFlags(flags)
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    flags,
    ctx.rawParsed.explicitFlags,
    ctx.rawParsed.flagOccurrences,
    'provider',
    STANDALONE_TTS_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-tts' }
  )
  if (
    providerNormalized.flags['all-tts'] !== true
    && !Object.values(STANDALONE_TTS_PROVIDER_TARGETS).some((flag) => {
      const value = providerNormalized.flags[flag]
      return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== false
    })
  ) {
    const cheapest = selectCheapestDefaultHostedTtsSelection()
    providerNormalized.flags[`${cheapest.provider}-tts`] = cheapest.model
  }
  const ttsNormalized = normalizeGenericTtsOptionFlags(
    providerNormalized.flags,
    providerNormalized.explicitFlags,
    providerNormalized.flagOccurrences
  )
  const speakerReferenceInputs = resolveStandaloneMistralTtsSpeakerReferenceInputs(
    ttsNormalized.flags,
    {
      explicitFlags: ttsNormalized.explicitFlags,
      flagOccurrences: ttsNormalized.flagOccurrences,
      cliReferenceInput: 'standalone-mistral'
    }
  )
  const rawSpeakerMappings = Array.isArray(ttsNormalized.flags['tts-speaker'])
    ? ttsNormalized.flags['tts-speaker'].filter((value): value is string => typeof value === 'string')
    : typeof ttsNormalized.flags['tts-speaker'] === 'string'
      ? [ttsNormalized.flags['tts-speaker']]
      : undefined
  const speakerReferencePlan = await planStandaloneMistralSpeakerReferences(
    rawSpeakerMappings,
    speakerReferenceInputs
  )
  const sanitizedFlags = speakerReferencePlan
    ? { ...ttsNormalized.flags, 'tts-speaker': [...speakerReferencePlan.ttsSpeakers] }
    : ttsNormalized.flags
  const ttsOptionResolutionAuthority = {
    cliReferenceInput: 'standalone-mistral',
    ...(speakerReferencePlan ? { mistralSpeakerReferences: 'sanitized' as const } : {})
  } as const
  const unresolvedTtsOptions: StandaloneTtsCommandOptions = buildOptsFromFlags(
    true,
    sanitizedFlags,
    {},
    ttsNormalized.explicitFlags,
    {
      flagOccurrences: ttsNormalized.flagOccurrences,
      ttsOptionResolutionAuthority
    }
  )
  const referenceInput = resolveStandaloneMistralTtsCliReferenceInput(
    ttsNormalized.flags,
    {
      explicitFlags: ttsNormalized.explicitFlags,
      cliReferenceInput: 'standalone-mistral'
    }
  )

  assertDialogueFormatIsUsable(unresolvedTtsOptions, ttsNormalized.explicitFlags)

  assertNoVoiceIdentityWithDialogue(unresolvedTtsOptions, ttsNormalized.explicitFlags)

  const protectedSpeakerOptions = speakerReferencePlan?.attach(unresolvedTtsOptions) ?? unresolvedTtsOptions
  const ttsOptions = await planStandaloneMistralReference(
    protectedSpeakerOptions,
    referenceInput
  )

  const targets = collectTtsTargets(ttsOptions)

  if (inputKind === 'directory') {
    await runTtsDirectoryBatch(inputPath, ttsOptions, targets, maxCents)
    return
  }

  await runSingleTtsInput(inputPath, ttsOptions, targets, maxCents)
})
