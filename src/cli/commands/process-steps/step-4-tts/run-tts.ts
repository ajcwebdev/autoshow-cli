import type { GenericTtsDialoguePlan, GenericTtsSourceIdentity, PipelineProviderState, SanitizedProviderError, Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { sanitizeModelName, runTargets } from '~/cli/commands/process-steps/target-runner'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import {
  collectTtsTargets,
  getTtsArtifactFileName,
  mergeTtsExecutionReadinessObservations,
  validateTtsTargetsForExecution,
  validateTtsInput,
} from './tts-targets'
import type { TtsExecutionReadinessObservation } from './tts-targets'
import { assertDialogueFormatIsUsable, isMultiSpeakerRequested } from './dialogue-normalizer'
import { runMultiSpeakerTts } from './run-multi-speaker-tts'
import { CLIUsageError, InternalError } from '~/utils/error-handler'
import { createHostedTtsChunkScheduler } from './tts-utils/hosted-tts-chunk-scheduler'
import type { CurrentTtsObservedTurn, CurrentTtsRenderArtifacts } from './script-to-audio/current-render-artifacts'
import { createCurrentTtsRenderAttempt, prepareCurrentTtsCompletedRecovery, resolveCurrentTtsPriorAdmittedAttemptCount, validateCurrentTtsRenderAttemptInputs } from './script-to-audio/current-render-attempt'
import { createCurrentTtsBlockedReadinessState } from './script-to-audio/current-readiness-attempt'

const getMetadataAudioPath = (outputDir: string, metadata: Step4Metadata): string =>
  `${outputDir}/${metadata.audioFileName}`

type WorkingTtsMetadata = Step4Metadata & {
  _ttsObservedTurns?: CurrentTtsObservedTurn[] | undefined
  _ttsRenderStrategy?: 'native-dialogue' | 'segmented' | undefined
}

type WorkingTtsResult = Step4Metadata & {
  _renderArtifacts: CurrentTtsRenderArtifacts
}

export type TtsRunSourceContext = {
  sourceIdentity: GenericTtsSourceIdentity
  dialoguePlan: GenericTtsDialoguePlan
  artifactOutputDir?: string | undefined
  artifactRoot?: string | undefined
  retainedProviderStates?: PipelineProviderState[] | undefined
  recoveryRootDir?: string | undefined
  executionReadiness?: readonly TtsExecutionReadinessObservation[] | undefined
  resolveReportedOutput?: ((target: TtsTarget, defaultFileName: string) => { path: string, fileName: string }) | undefined
  beforeDispatch?: ((preparedStates: PipelineProviderState[]) => Promise<void>) | undefined
  onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
}

const resolveTtsExecutionReadiness = (
  targets: readonly TtsTarget[],
  observed: readonly TtsExecutionReadinessObservation[]
): {
  byTargetKey: ReadonlyMap<string, TtsExecutionReadinessObservation>
  blocked: readonly TtsExecutionReadinessObservation[]
} => {
  const byTargetKey = new Map<string, TtsExecutionReadinessObservation>()
  for (const entry of observed) {
    if (!entry.targetKey || byTargetKey.has(entry.targetKey)) {
      throw InternalError('TTS execution readiness must contain one unique observation per operation-scoped target.', { stage: 'tts:readiness' })
    }
    if (
      (entry.status === 'ready' && (entry.accountState !== 'available' || entry.error !== undefined))
      || (entry.status === 'blocked' && (entry.accountState === 'available' || entry.error?.phase !== 'readiness'))
    ) {
      throw InternalError(`TTS execution readiness is contradictory for ${entry.targetKey}.`, { stage: 'tts:readiness' })
    }
    byTargetKey.set(entry.targetKey, entry)
  }
  for (const target of targets) {
    if (!target.targetKey || !byTargetKey.has(target.targetKey)) {
      throw InternalError(`TTS execution readiness is missing ${target.service}/${target.model}.`, { stage: 'tts:readiness' })
    }
  }
  return {
    byTargetKey,
    blocked: observed.filter((entry) => entry.status === 'blocked')
  }
}

const withRunScopedHostedTtsChunkScheduler = (options: TtsOptions): TtsOptions => {
  if (!options.hostedTtsChunkScheduler) {
    options.hostedTtsChunkScheduler = createHostedTtsChunkScheduler(options.ttsChunkConcurrency)
  }
  return options
}

export const validateTtsRenderInputsForTargets = (
  targets: TtsTarget[],
  text: string,
  options: TtsOptions,
  sourceContext?: Pick<TtsRunSourceContext, 'sourceIdentity' | 'dialoguePlan'> | undefined
): void => {
  for (const target of targets) validateCurrentTtsRenderAttemptInputs({
    target,
    sourceText: text,
    ttsOptions: options,
    sourceIdentity: sourceContext?.sourceIdentity,
    dialoguePlan: sourceContext?.dialoguePlan
  })
}

export const runTtsTargets = async (
  targets: TtsTarget[],
  text: string,
  outputDir: string,
  _options: TtsOptions,
  sourceContext?: TtsRunSourceContext | undefined
): Promise<Step4Metadata[]> => {
  validateTtsRenderInputsForTargets(targets, text, _options, sourceContext)
  const preObservedReadiness = sourceContext?.executionReadiness
  const hasAuthoritativeBlock = preObservedReadiness?.some((entry) => entry.status === 'blocked') ?? false
  const locallyObservedReadiness = hasAuthoritativeBlock
    ? []
    : await validateTtsTargetsForExecution(targets)
  const executionReadiness = resolveTtsExecutionReadiness(
    targets,
    preObservedReadiness
      ? mergeTtsExecutionReadinessObservations(preObservedReadiness, locallyObservedReadiness)
      : locallyObservedReadiness
  )
  if (executionReadiness.blocked.length > 0) {
    const orderedBlockedStates = await Promise.all(targets.map(async (target) => {
      const readiness = target.targetKey ? executionReadiness.byTargetKey.get(target.targetKey) : undefined
      if (!readiness) {
        throw InternalError(`TTS execution readiness is missing ${target.service}/${target.model}.`, { stage: 'tts:readiness' })
      }
      return await createCurrentTtsBlockedReadinessState({
        outputDir: sourceContext?.artifactOutputDir ?? outputDir,
        artifactRoot: sourceContext?.artifactRoot,
        target,
        sourceText: text,
        ttsOptions: _options,
        sourceIdentity: sourceContext?.sourceIdentity,
        dialoguePlan: sourceContext?.dialoguePlan,
        readiness,
        peerBlocked: readiness.status === 'ready'
      })
    }))
    if (sourceContext?.beforeDispatch) {
      await sourceContext.beforeDispatch(orderedBlockedStates)
    } else {
      await Promise.all(orderedBlockedStates.map(async (state) => await sourceContext?.onProviderState?.(state)))
    }
    const messages = executionReadiness.blocked.flatMap((entry) => entry.error?.message ? [entry.error.message] : [])
    throw CLIUsageError(
      `TTS execution readiness failed before synthesis${messages.length > 0 ? `: ${messages.join('; ')}` : '.'}`
    )
  }
  const options = withRunScopedHostedTtsChunkScheduler(_options)
  const attempts = new Map<TtsTarget, Awaited<ReturnType<typeof createCurrentTtsRenderAttempt>>>()
  const recoveries = new Map<TtsTarget, Extract<NonNullable<Awaited<ReturnType<typeof prepareCurrentTtsCompletedRecovery>>>, { kind: 'complete-render' }>>()
  const preparedStates = new Map<TtsTarget, PipelineProviderState>()
  let dispatchBarrierPassed = false
  const retainedByTargetKey = new Map(sourceContext?.retainedProviderStates?.flatMap((state) => state.targetKey ? [[state.targetKey, state] as const] : []) ?? [])
  const preparedAttempts = await Promise.all(targets.map(async (target) => {
    const onProviderState = async (state: PipelineProviderState): Promise<void> => {
      if (!dispatchBarrierPassed) {
        preparedStates.set(target, state)
        return
      }
      await sourceContext?.onProviderState?.(state)
    }
    const retainedState = target.targetKey ? retainedByTargetKey.get(target.targetKey) : undefined
    const retainedProjection = retainedState?.result?.['ttsAudio'] as { activeWork?: { kind?: unknown } } | undefined
    let recoveredSlots: Extract<NonNullable<Awaited<ReturnType<typeof prepareCurrentTtsCompletedRecovery>>>, { kind: 'partial-slots' }>['recoveredSlots'] | undefined
    let retainedCumulativePlannedCost: Extract<NonNullable<Awaited<ReturnType<typeof prepareCurrentTtsCompletedRecovery>>>, { kind: 'partial-slots' }>['retainedCumulativePlannedCost'] | undefined
    if (retainedState && retainedProjection?.activeWork?.kind === 'render') {
      const recovery = await prepareCurrentTtsCompletedRecovery({
        rootDir: sourceContext?.recoveryRootDir ?? sourceContext?.artifactOutputDir ?? outputDir,
        state: retainedState,
        target,
        sourceText: text,
        ttsOptions: options,
        sourceIdentity: sourceContext?.sourceIdentity,
        dialoguePlan: sourceContext?.dialoguePlan,
        onProviderState
      })
      if (recovery) {
        if (recovery.kind === 'complete-render') {
          preparedStates.set(target, recovery.preparedState)
          return { target, recovery }
        }
        if (recovery.kind === 'partial-slots') recoveredSlots = recovery.recoveredSlots
        retainedCumulativePlannedCost = recovery.retainedCumulativePlannedCost
      }
    }
    const priorAttemptCount = retainedState
      ? await resolveCurrentTtsPriorAdmittedAttemptCount({
          rootDir: sourceContext?.recoveryRootDir ?? sourceContext?.artifactOutputDir ?? outputDir,
          state: retainedState
        })
      : undefined
    return {
      target,
      attempt: await createCurrentTtsRenderAttempt({
      outputDir: sourceContext?.artifactOutputDir ?? outputDir,
      artifactRoot: sourceContext?.artifactRoot,
      target,
      sourceText: text,
      ttsOptions: options,
      sourceIdentity: sourceContext?.sourceIdentity,
      dialoguePlan: sourceContext?.dialoguePlan,
      priorAttemptCount,
      recoveredSlots,
      retainedCumulativePlannedCost,
      onProviderState
    })
    }
  }))
  for (const entry of preparedAttempts) {
    if ('attempt' in entry) attempts.set(entry.target, entry.attempt)
    else recoveries.set(entry.target, entry.recovery)
  }
  const orderedPreparedStates = targets.map((target) => {
    const state = preparedStates.get(target)
    if (!state) throw InternalError(`Missing prepared TTS provider state for ${target.service}/${target.model}.`, { stage: 'tts:run' })
    return state
  })
  if (sourceContext?.beforeDispatch) {
    await sourceContext.beforeDispatch(orderedPreparedStates)
  } else {
    await Promise.all(orderedPreparedStates.map(async (state) => await sourceContext?.onProviderState?.(state)))
  }
  dispatchBarrierPassed = true
  return await runTargets<TtsTarget, Step4Metadata>({
    targets,
    outputDir,
    stepLabel: 'TTS',
    noProviderMessage: 'No provider produced audio',
    concurrency: {
      provider: options.ttsProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY,
      local: options.ttsLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY
    },
    getTargetPool: (target) => target.service === 'kitten' ? 'local' : 'hosted',
    getWorkspaceDir: (dir, target) =>
      `${dir}/.tts-tmp-${target.service}-${sanitizeModelName(target.model)}`,
    useWorkspaceForSingleTarget: true,
    resourceGate: options.generationResourceGate,
    getResourceGate: (target) => isMultiSpeakerRequested(options) && target.service === 'kitten'
      ? undefined
      : options.generationResourceGate,
    runTarget: async (target, workspaceDir) => {
      const defaultFileName = getTtsArtifactFileName(target, targets.length === 1)
      const reportedOutput = sourceContext?.resolveReportedOutput?.(target, defaultFileName)
        ?? { path: `${outputDir}/${defaultFileName}`, fileName: defaultFileName }
      const recovery = recoveries.get(target)
      if (recovery) {
        const startedAt = Date.now()
        const renderArtifacts = await recovery.finalize(workspaceDir, reportedOutput.path)
        return {
          ttsService: target.service,
          ttsModel: target.model,
          speaker: target.voice ?? 'retained-voice-binding',
          processingTime: Date.now() - startedAt,
          audioFileName: reportedOutput.fileName,
          audioFileSize: Bun.file(reportedOutput.path).size,
          chunkCount: recovery.chunkCount,
          operation: renderArtifacts.operation,
          targetKey: renderArtifacts.targetKey,
          transport: renderArtifacts.transport,
          artifactDir: renderArtifacts.artifactDir,
          renderIdentity: renderArtifacts.renderIdentity,
          resultIdentity: renderArtifacts.resultIdentity,
          audioRunId: renderArtifacts.audioRunId,
          renderStrategy: renderArtifacts.strategy,
          ttsAudio: renderArtifacts.projection,
          _renderArtifacts: renderArtifacts
        } as WorkingTtsResult
      }
      const attempt = attempts.get(target)
      if (!attempt) throw InternalError(`Missing prepared TTS render attempt for ${target.service}/${target.model}.`, { stage: 'tts:run' })
      try {
        const { audioPath, metadata: rawMetadata } = await target.run(text, workspaceDir, options, undefined, attempt.requestEvidence)
        const { _ttsObservedTurns: _ignoredTurns, _ttsRenderStrategy: _ignoredStrategy, ...metadata } = rawMetadata as WorkingTtsMetadata
        const renderArtifacts = await attempt.finalizeSuccess(audioPath, reportedOutput.path)
        return {
          ...metadata,
          audioFileName: reportedOutput.fileName,
          audioFileSize: Bun.file(reportedOutput.path).size,
          operation: renderArtifacts.operation,
          targetKey: renderArtifacts.targetKey,
          transport: renderArtifacts.transport,
          artifactDir: renderArtifacts.artifactDir,
          renderIdentity: renderArtifacts.renderIdentity,
          resultIdentity: renderArtifacts.resultIdentity,
          audioRunId: renderArtifacts.audioRunId,
          renderStrategy: renderArtifacts.strategy,
          ttsAudio: renderArtifacts.projection,
          _renderArtifacts: renderArtifacts
        } as WorkingTtsResult
      } catch (error) {
        const failure = await attempt.finalizeFailure(error)
        const sanitized = failure.error as SanitizedProviderError | undefined
        const safeError = new Error(sanitized?.message ?? 'TTS target failed without exposing provider response details.')
        if (sanitized?.code.startsWith('http_')) {
          const status = Number.parseInt(sanitized.code.slice('http_'.length), 10)
          if (Number.isInteger(status)) Object.defineProperty(safeError, 'status', { value: status, configurable: true })
        }
        throw safeError
      }
    },
    finalizeTarget: async (_target, result) => {
      const { _renderArtifacts: _ignoredArtifacts, ...metadata } = result as WorkingTtsResult
      return metadata as Step4Metadata
    }
  })
}

export const runTts = async (
  text: string,
  outputDir: string,
  options: TtsOptions
): Promise<{ audioPaths: string[], metadata: Step4Metadata[] }> => {
  // Pipeline entry point: there are no explicit flags here, so a stored dialogue format warns and
  // the run continues as single-speaker instead of aborting step 4 after three paid steps.
  assertDialogueFormatIsUsable(options)
  validateTtsInput(text, options)
  const targets = collectTtsTargets(options)

  if (targets.length === 0) {
    throw InternalError('No TTS provider configured', { stage: 'tts:run' })
  }

  return await runTtsForTargets(text, outputDir, options, targets)
}

export const runTtsForTargets = async (
  text: string,
  outputDir: string,
  options: TtsOptions,
  targets: TtsTarget[],
  sourceContext?: TtsRunSourceContext | undefined
): Promise<{ audioPaths: string[], metadata: Step4Metadata[] }> => {
  if (targets.length === 0) {
    return { audioPaths: [], metadata: [] }
  }

  if (isMultiSpeakerRequested(options)) {
    const wrappedTargets: TtsTarget[] = targets.map((target) => ({
      ...target,
      run: async (t: string, dir: string, _opts: TtsOptions, _invocation, requestEvidence) =>
        runMultiSpeakerTts(t, dir, target, _opts, requestEvidence)
    }))
    const metadata = await runTtsTargets(wrappedTargets, text, outputDir, options, sourceContext)
    return {
      audioPaths: metadata.map((entry) => getMetadataAudioPath(outputDir, entry)),
      metadata
    }
  }

  const metadata = await runTtsTargets(targets, text, outputDir, options, sourceContext)
  return {
    audioPaths: metadata.map((entry) => getMetadataAudioPath(outputDir, entry)),
    metadata
  }
}
