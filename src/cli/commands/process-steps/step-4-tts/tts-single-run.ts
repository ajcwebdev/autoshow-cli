import { statPath as stat } from '~/utils/bun-file-io'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir } from '~/cli/commands/process-steps/generation-command-utils'
import { createManifest, createPipelineItemFromRecord, updateManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildPipelineItemRecord } from '~/cli/commands/process-steps/step-0-metadata/metadata-batch/pipeline-item-record-builder'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { evaluatePreflightEstimate } from '~/cli/commands/pricing-orchestration/preflight'
import type { AggregatedPriceEstimate, PipelineItemRecord, PipelineProviderState, PreparedTtsInput, PreparedTtsRun, StandaloneTtsCommandOptions, Step4Metadata, TtsExecutionReadinessObservation, TtsOptions, TtsRunSourceContext, TtsTarget } from '~/types'
import { UsageError, hasErrorCode } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { isMultiSpeakerRequested, normalizeDialogueFromOptions } from './dialogue-normalizer'
import { runTtsForTargets, validateTtsRenderInputsForTargets } from './run-tts'
import { buildEstimatedTtsTargets, buildTtsArtifactMap, collectTtsTargets, getTtsArtifactFileName, mergeTtsExecutionReadinessObservations, validateTtsTargetsForExecution } from './tts-targets'
import { materializeStandaloneMistralReference } from './voice-assets/standalone-mistral-reference'
import { hasMistralProtectedReferences } from './voice-assets/mistral-protected-reference-binding'
import { appendCurrentTtsProviderState } from './script-to-audio/current-render-artifacts'
import { createFileTtsSourceIdentity, createGenericTtsDialoguePlan, createSingleTurnTtsDialoguePlan } from './script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from './script-to-audio/item-dialogue-plan-artifact'
import { buildTtsEstimateForInput } from './tts-batch-estimates'
import { getInputStem } from './tts-batch-plan'

export const getTtsInputKind = async (inputPath: string): Promise<'file' | 'directory'> => {
  try {
    const stats = await stat(inputPath)
    if (stats.isDirectory()) {
      return 'directory'
    }
    if (stats.isFile()) {
      return 'file'
    }
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      throw UsageError(`File not found: ${inputPath}`, undefined, error instanceof Error ? { cause: error } : {})
    }
    throw error
  }

  throw UsageError(`tts input must be a file or directory. Got: ${inputPath}`)
}

export const prepareTtsInput = async (
  inputPath: string,
  ttsOptions: TtsOptions,
  createdAt: string
): Promise<PreparedTtsInput> => {
  const sourceBytes = new Uint8Array(await Bun.file(inputPath).arrayBuffer())
  const text = new TextDecoder().decode(sourceBytes)
  if (!text.trim()) {
    throw UsageError(`Input file is empty: ${inputPath}`)
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

export const reduceTtsProviderStates = (
  providers: readonly PipelineProviderState[]
): 'full' | 'incomplete' | 'failed' | 'skipped' => {
  if (providers.length === 0) {
    throw UsageError('A canonical TTS item requires every requested target\'s real lifecycle state.')
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

export const requestedTtsProviders = (targets: readonly TtsTarget[]) => targets.map((target) => ({
  service: target.service,
  model: target.model,
  local: false,
  operation: target.operation,
  targetKey: target.targetKey,
  transport: target.transport
}))

export const orderedTtsProviderStates = (
  targets: readonly TtsTarget[],
  states: ReadonlyMap<string, PipelineProviderState>
): PipelineProviderState[] => targets.map((target) => {
  if (!target.targetKey) {
    throw UsageError(`TTS target ${target.service}/${target.model} is missing its operation-scoped targetKey.`)
  }
  const state = states.get(target.targetKey)
  if (!state) {
    throw UsageError(`TTS lifecycle did not durably prepare ${target.service}/${target.model} before dispatch.`)
  }
  return state
})

export const writeInitialTtsManifest = async (
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

export const synthesizePreparedTtsInputForTargets = async (
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
          throw UsageError('TTS lifecycle produced a prepared state without an operation-scoped targetKey.')
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
        throw UsageError('TTS lifecycle produced a provider state without an operation-scoped targetKey.')
      }
      let committed: PipelineProviderState | undefined
      await updateManifest(outputDir, (manifest) => {
        if (manifest.command !== 'tts' || manifest.scope !== 'single' || manifest.items.length !== 1) {
          throw UsageError('TTS lifecycle can update only its canonical single-run manifest.')
        }
        const item = manifest.items[0]
        if (!item) throw UsageError('Canonical single-run TTS manifest is missing its item.')
        const providerIndex = item.providers.findIndex((provider) => provider.targetKey === state.targetKey)
        const current = item.providers[providerIndex]
        if (!current) {
          throw UsageError(`Canonical single-run TTS manifest is missing lifecycle state for ${state.targetKey}.`)
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
      throw UsageError('TTS completion can update only its canonical single-run manifest.')
    }
    const item = manifest.items[0]
    if (!item) throw UsageError('Canonical single-run TTS manifest is missing its item.')
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

export const runSingleTtsInput = async (
  inputPath: string,
  ttsOptions: StandaloneTtsCommandOptions,
  targets: TtsTarget[],
  maxCents: number | undefined
): Promise<void> => {
  if (!isTextInputPath(inputPath)) {
    throw UsageError(`tts only accepts .md or .txt files. Got: ${inputPath}`)
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
