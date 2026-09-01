import type { PipelineProviderState, SanitizedProviderError, Step4Metadata, TtsExecutionReadinessObservation, TtsOptions, TtsRunSourceContext, TtsTarget, WorkingTtsMetadata, WorkingTtsResult } from '~/types'
import { sanitizeModelName, runTargets } from '~/cli/commands/process-steps/target-runner'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import {
  collectTtsTargets,
  getTtsArtifactFileName,
  mergeTtsExecutionReadinessObservations,
  validateTtsTargetsForExecution,
  validateTtsInput,
} from './tts-targets'
import { assertDialogueFormatIsUsable, isMultiSpeakerRequested } from './dialogue-normalizer'
import { runMultiSpeakerTts } from './run-multi-speaker-tts'
import { UsageError, InfraError, InternalError } from '~/utils/error-handler'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { bindHostedTtsChunkScheduler, createHostedTtsChunkScheduler } from './tts-utils/hosted-tts-chunk-scheduler'
import { createCurrentTtsRenderAttempt, planCurrentTtsRenderIdentity, planCurrentTtsResumePrice, prepareCurrentTtsCompatibleSlotRecovery, prepareCurrentTtsCompletedRecovery, resolveCurrentTtsPriorAdmittedAttemptCount, validateCurrentTtsRenderAttemptInputs } from './script-to-audio/current-render-attempt'
import { createCurrentTtsBlockedReadinessState } from './script-to-audio/current-readiness-attempt'
import { buildWorkingTtsResult } from './working-tts-result'
import { sanitizeError } from './script-to-audio/attempt-planning-shared'
import { runWithTtsConfigLogScope } from './tts-utils/log-tts-config'

const getMetadataAudioPath = (outputDir: string, metadata: Step4Metadata): string =>
  `${outputDir}/${metadata.audioFileName}`

const describeFailedTtsRecovery = async (options: {
  rootDir: string
  state: PipelineProviderState
  target: TtsTarget
  sourceText: string
  ttsOptions: TtsOptions
  sourceContext?: TtsRunSourceContext | undefined
}): Promise<string | undefined> => {
  try {
    const recovery = await planCurrentTtsResumePrice({
      rootDir: options.rootDir,
      state: options.state,
      target: options.target,
      sourceText: options.sourceText,
      ttsOptions: options.ttsOptions,
      sourceIdentity: options.sourceContext?.sourceIdentity,
      dialoguePlan: options.sourceContext?.dialoguePlan,
      comicContext: options.sourceContext?.comicContext
    })
    const totalSlotCount = recovery.recoveredSlotCount + recovery.unresolvedSlotCount
    const blockedSlotCount = new Set(recovery.reconciliationBlockers.map((blocker) => blocker.generationSlotId)).size
    if (recovery.recoveredSlotCount === 0 && blockedSlotCount === 0) return undefined

    const checkpoint = `Recovery checkpoint: ${recovery.recoveredSlotCount}/${totalSlotCount} generation slots retained; ${recovery.unresolvedSlotCount} unresolved.`
    if (blockedSlotCount === 0) {
      return `${checkpoint} Rerun the same command to reuse retained audio and resume synthesis without deleting the output directory.`
    }

    const redispatchFlag = '--allow-ambiguous-redispatch'
    const manifest = await readManifest(options.rootDir)
    const resumeHint = manifest?.scope === 'batch'
      ? `Run bun autoshow resume ${options.rootDir} ${redispatchFlag}`
      : `Rerun the same command with ${redispatchFlag}`
    return `${checkpoint} ${blockedSlotCount} unresolved ${blockedSlotCount === 1 ? 'slot has' : 'slots have'} ambiguous provider admission. ${resumeHint} to reconcile those slots, reuse retained audio, and resume without deleting the output directory; authorized slots may be purchased again.`
  } catch {
    return undefined
  }
}

const selectBoundedExecutionOptions = (
  options: TtsOptions,
  selection: readonly { turnId: string, sourceIndex: number, speaker: string, providerSegmentIndex: number, providerText: string }[] | undefined
): TtsOptions => {
  if (!selection) return options
  const selectedByTurn = new Map<string, typeof selection>()
  for (const entry of selection) selectedByTurn.set(entry.turnId, [...(selectedByTurn.get(entry.turnId) ?? []), entry])
  const selectedTurns = options.ttsCanonicalTurns
    ? options.ttsCanonicalTurns.flatMap((turn) => {
        const entries = selectedByTurn.get(turn.turnId)
        if (!entries?.length) return []
        return [{
          ...turn,
          sourceIndex: entries[0]?.sourceIndex,
          providerSegments: entries.map((entry) => entry.providerText),
          providerSegmentIndexes: entries.map((entry) => entry.providerSegmentIndex)
        }]
      })
    : [...selectedByTurn].map(([turnId, entries]) => ({
        turnId,
        sourceIndex: entries[0]?.sourceIndex,
        speaker: entries[0]?.speaker ?? 'NARRATOR',
        text: entries.map((entry) => entry.providerText).join(' '),
        providerSegments: entries.map((entry) => entry.providerText),
        providerSegmentIndexes: entries.map((entry) => entry.providerSegmentIndex),
      }))
  if (!selectedTurns?.length) throw UsageError('Bounded TTS execution did not select any canonical dialogue turns.')
  const selectedTurnIds = new Set(selectedTurns.map(turn => turn.turnId))
  const selectedTurnControls = options.ttsTurnControls
    ? Object.fromEntries(Object.entries(options.ttsTurnControls).filter(([turnId]) => selectedTurnIds.has(turnId)))
    : undefined
  return {
    ...options,
    ttsCanonicalTurns: selectedTurns,
    ...(selectedTurnControls ? { ttsTurnControls: selectedTurnControls } : {}),
    ttsChunkConcurrency: 1
  }
}

const selectSingleSpeakerExecutionOptions = (
  options: TtsOptions,
  target: TtsTarget,
  selection: NonNullable<CurrentRenderAttempt['executionSelection']>,
  checkpointRequired: boolean
): TtsOptions => {
  const voicesBySpeaker = new Map<string, string>()
  for (const entry of selection) {
    const voice = entry.voice ?? target.voice
    if (!voice) throw UsageError(`Selected TTS recovery cannot reconstruct the retained voice for ${entry.speaker}.`)
    const current = voicesBySpeaker.get(entry.speaker)
    if (current !== undefined && current !== voice) {
      throw UsageError(`Selected TTS recovery found conflicting retained voices for ${entry.speaker}.`)
    }
    voicesBySpeaker.set(entry.speaker, voice)
  }
  return {
    ...options,
    ttsDialogueFormat: 'labeled',
    ttsSpeakers: [...voicesBySpeaker].map(([speaker, voice]) => `${speaker}=${voice}`),
    ttsCanonicalTurns: selection.map((entry) => ({
      turnId: entry.turnId,
      sourceIndex: entry.sourceIndex,
      speaker: entry.speaker,
      text: entry.providerText,
      providerSegments: [entry.providerText],
      providerSegmentIndexes: [entry.providerSegmentIndex]
    })),
    ...(checkpointRequired ? { ttsChunkConcurrency: 1 } : {})
  }
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
    options.hostedTtsChunkScheduler = createHostedTtsChunkScheduler({
      maxConcurrency: options.ttsChunkConcurrency,
      concurrencyMode: options.concurrencyMode,
      hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator
    })
  }
  return options
}

export const validateTtsRenderInputsForTargets = (
  targets: TtsTarget[],
  text: string,
  options: TtsOptions,
  sourceContext?: Pick<TtsRunSourceContext, 'sourceIdentity' | 'dialoguePlan' | 'comicContext'> | undefined
): void => {
  for (const target of targets) validateCurrentTtsRenderAttemptInputs({
    target,
    sourceText: text,
    ttsOptions: options,
    sourceIdentity: sourceContext?.sourceIdentity,
    dialoguePlan: sourceContext?.dialoguePlan,
    comicContext: sourceContext?.comicContext
  })
}

type CurrentRenderAttempt = Awaited<ReturnType<typeof createCurrentTtsRenderAttempt>>
type CompletedRenderRecovery = Extract<NonNullable<Awaited<ReturnType<typeof prepareCurrentTtsCompletedRecovery>>>, { kind: 'complete-render' }>
type PartialRenderRecovery = Extract<NonNullable<Awaited<ReturnType<typeof prepareCurrentTtsCompletedRecovery>>>, { kind: 'partial-slots' }>
type PreparedTarget = { target: TtsTarget, attempt: CurrentRenderAttempt } | { target: TtsTarget, recovery: CompletedRenderRecovery }

const resolveExecutionReadinessForRun = async (
  targets: TtsTarget[],
  sourceContext?: TtsRunSourceContext | undefined
) => {
  const preObserved = sourceContext?.executionReadiness
  const local = preObserved?.some(entry => entry.status === 'blocked')
    ? []
    : await validateTtsTargetsForExecution(targets)
  return resolveTtsExecutionReadiness(targets, preObserved ? mergeTtsExecutionReadinessObservations(preObserved, local) : local)
}

const persistBlockedReadiness = async (input: {
  targets: TtsTarget[]
  text: string
  outputDir: string
  options: TtsOptions
  sourceContext?: TtsRunSourceContext | undefined
  readiness: ReturnType<typeof resolveTtsExecutionReadiness>
}): Promise<never> => {
  const states = await Promise.all(input.targets.map(async target => {
    const readiness = target.targetKey ? input.readiness.byTargetKey.get(target.targetKey) : undefined
    if (!readiness) throw InternalError(`TTS execution readiness is missing ${target.service}/${target.model}.`, { stage: 'tts:readiness' })
    return await createCurrentTtsBlockedReadinessState({
      outputDir: input.sourceContext?.artifactOutputDir ?? input.outputDir,
      artifactRoot: input.sourceContext?.artifactRoot,
      target,
      sourceText: input.text,
      ttsOptions: input.options,
      sourceIdentity: input.sourceContext?.sourceIdentity,
      dialoguePlan: input.sourceContext?.dialoguePlan,
      comicContext: input.sourceContext?.comicContext,
      readiness,
      peerBlocked: readiness.status === 'ready',
    })
  }))
  if (input.sourceContext?.beforeDispatch) await input.sourceContext.beforeDispatch(states)
  else await Promise.all(states.map(async state => await input.sourceContext?.onProviderState?.(state)))
  const messages = input.readiness.blocked.flatMap(entry => entry.error?.message ? [entry.error.message] : [])
  throw UsageError(`TTS execution readiness failed before synthesis${messages.length > 0 ? `: ${messages.join('; ')}` : '.'}`)
}

const recoveryRoot = (outputDir: string, sourceContext?: TtsRunSourceContext | undefined): string =>
  sourceContext?.recoveryRootDir ?? sourceContext?.artifactOutputDir ?? outputDir

const prepareTargetForExecution = async (input: {
  target: TtsTarget
  text: string
  outputDir: string
  options: TtsOptions
  sourceContext?: TtsRunSourceContext | undefined
  retainedByTargetKey: ReadonlyMap<string, PipelineProviderState>
  preparedStates: Map<TtsTarget, PipelineProviderState>
  dispatchBarrier: { passed: boolean }
}): Promise<PreparedTarget> => {
  const { target, text, outputDir, options, sourceContext } = input
  const onProviderState = async (state: PipelineProviderState): Promise<void> => {
    if (!input.dispatchBarrier.passed) input.preparedStates.set(target, state)
    else await sourceContext?.onProviderState?.(state)
  }
  const retainedState = target.targetKey ? input.retainedByTargetKey.get(target.targetKey) : undefined
  const retainedNamespace = retainedState?.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  const projection = retainedState?.result?.[retainedNamespace] as {
    activeWork?: { kind?: unknown, renderIdentity?: unknown } | undefined
    renderHistory?: Array<{ renderIdentity?: unknown }> | undefined
    archive?: unknown
    selectedSuccess?: { renderIdentity?: unknown } | undefined
  } | undefined
  let recoveredSlots: PartialRenderRecovery['recoveredSlots'] | undefined
  let retainedCumulativePlannedCost: PartialRenderRecovery['retainedCumulativePlannedCost'] | undefined
  const plannedRenderIdentity = retainedState ? planCurrentTtsRenderIdentity({
    target,
    sourceText: text,
    ttsOptions: options,
    sourceIdentity: sourceContext?.sourceIdentity,
    dialoguePlan: sourceContext?.dialoguePlan,
    comicContext: sourceContext?.comicContext,
  }).renderIdentity : undefined
  const hasPlannedRender = plannedRenderIdentity !== undefined && projection?.activeWork?.kind === 'render'
    && projection.activeWork.renderIdentity === plannedRenderIdentity
    && projection.renderHistory?.some(render => render.renderIdentity === plannedRenderIdentity) === true
  const sameRenderArchive = Boolean(projection?.archive && projection.selectedSuccess?.renderIdentity === plannedRenderIdentity)
  if (retainedState && (hasPlannedRender || sameRenderArchive)) {
    const recovery = await prepareCurrentTtsCompletedRecovery({
      rootDir: recoveryRoot(outputDir, sourceContext),
      state: retainedState,
      target,
      sourceText: text,
      ttsOptions: options,
      sourceIdentity: sourceContext?.sourceIdentity,
      dialoguePlan: sourceContext?.dialoguePlan,
      comicContext: sourceContext?.comicContext,
      onProviderState,
    })
    if (recovery?.kind === 'complete-render') {
      input.preparedStates.set(target, recovery.preparedState)
      return { target, recovery }
    }
    if (recovery?.kind === 'partial-slots') recoveredSlots = recovery.recoveredSlots
    if (recovery) retainedCumulativePlannedCost = recovery.retainedCumulativePlannedCost
  }
  if (retainedState && !hasPlannedRender && !sameRenderArchive) {
    const recovery = await prepareCurrentTtsCompatibleSlotRecovery({
      rootDir: recoveryRoot(outputDir, sourceContext),
      outputDir: sourceContext?.artifactOutputDir ?? outputDir,
      artifactRoot: sourceContext?.artifactRoot,
      state: retainedState,
      target,
      sourceText: text,
      ttsOptions: options,
      sourceIdentity: sourceContext?.sourceIdentity,
      dialoguePlan: sourceContext?.dialoguePlan,
      comicContext: sourceContext?.comicContext,
    })
    if (recovery?.kind === 'partial-slots') recoveredSlots = recovery.recoveredSlots
    if (recovery) retainedCumulativePlannedCost = recovery.retainedCumulativePlannedCost
  }
  const priorAttemptCount = retainedState ? await resolveCurrentTtsPriorAdmittedAttemptCount({ rootDir: recoveryRoot(outputDir, sourceContext), state: retainedState }) : undefined
  const attempt = await createCurrentTtsRenderAttempt({
    outputDir: sourceContext?.artifactOutputDir ?? outputDir,
    artifactRoot: sourceContext?.artifactRoot,
    target,
    sourceText: text,
    ttsOptions: options,
    sourceIdentity: sourceContext?.sourceIdentity,
    dialoguePlan: sourceContext?.dialoguePlan,
    comicContext: sourceContext?.comicContext,
    priorAttemptCount,
    recoveredSlots,
    retainedCumulativePlannedCost,
    onProviderState,
  })
  return { target, attempt }
}

const publishPreparedStatesBeforeDispatch = async (input: {
  targets: TtsTarget[]
  preparedStates: ReadonlyMap<TtsTarget, PipelineProviderState>
  sourceContext?: TtsRunSourceContext | undefined
  dispatchBarrier: { passed: boolean }
}): Promise<void> => {
  const states = input.targets.map(target => {
    const state = input.preparedStates.get(target)
    if (!state) throw InternalError(`Missing prepared TTS provider state for ${target.service}/${target.model}.`, { stage: 'tts:run' })
    return state
  })
  if (input.sourceContext?.beforeDispatch) await input.sourceContext.beforeDispatch(states)
  else await Promise.all(states.map(async state => await input.sourceContext?.onProviderState?.(state)))
  input.dispatchBarrier.passed = true
}

const runPreparedTtsTarget = async (input: {
  target: TtsTarget
  workspaceDir: string
  targets: TtsTarget[]
  text: string
  outputDir: string
  options: TtsOptions
  sourceContext?: TtsRunSourceContext | undefined
  attempts: ReadonlyMap<TtsTarget, CurrentRenderAttempt>
  recoveries: ReadonlyMap<TtsTarget, CompletedRenderRecovery>
}): Promise<WorkingTtsResult> => {
  const { target, targets, sourceContext, outputDir, options } = input
  const targetIndex = targets.indexOf(target)
  const sourceInputIndex = sourceContext?.sourceIdentity?.sourceLocator?.kind === 'batch-item' ? sourceContext.sourceIdentity.sourceLocator.itemIndex : 0
  const schedulerJob = { jobId: `tts-input-${sourceInputIndex}-target-${targetIndex}`, label: `input-${sourceInputIndex + 1}-target-${targetIndex + 1}`, inputIndex: sourceInputIndex, targetIndex, originalOrder: sourceInputIndex * targets.length + targetIndex }
  const defaultFileName = getTtsArtifactFileName(target, targets.length === 1)
  const reportedOutput = sourceContext?.resolveReportedOutput?.(target, defaultFileName) ?? { path: `${outputDir}/${defaultFileName}`, fileName: defaultFileName }
  const recovery = input.recoveries.get(target)
  if (recovery) {
    const startedAt = Date.now()
    return buildWorkingTtsResult({ mode: 'local-finalize', target, reportedOutput, startedAt, chunkCount: recovery.chunkCount, renderArtifacts: await recovery.finalize(input.workspaceDir, reportedOutput.path) })
  }
  const attempt = input.attempts.get(target)
  if (!attempt) throw InternalError(`Missing prepared TTS render attempt for ${target.service}/${target.model}.`, { stage: 'tts:run' })
  let providerRunCompleted = false
  try {
    if (!attempt.providerDispatchRequired) {
      providerRunCompleted = true
      return buildWorkingTtsResult({ mode: 'local-finalize', target, reportedOutput, startedAt: Date.now(), chunkCount: attempt.plannedChunkCount, renderArtifacts: await attempt.finalizeSuccess('', reportedOutput.path) })
    }
    const singleSpeakerSelection = attempt.executionSelection && !isMultiSpeakerRequested(options)
      ? attempt.executionSelection
      : undefined
    const boundedOptions = singleSpeakerSelection
      ? selectSingleSpeakerExecutionOptions(options, target, singleSpeakerSelection, attempt.executionCheckpointRequired)
      : selectBoundedExecutionOptions(options, attempt.executionSelection)
    const executionOptions: TtsOptions = boundedOptions.hostedTtsChunkScheduler ? {
      ...boundedOptions,
      hostedTtsChunkJobContext: schedulerJob,
      hostedTtsChunkScheduler: bindHostedTtsChunkScheduler(boundedOptions.hostedTtsChunkScheduler, { job: schedulerJob, scopeLabel: boundedOptions.hostedTtsLaneScopeLabel }),
    } : boundedOptions
    const recoveryTarget = singleSpeakerSelection && target.multiSpeakerStrategy === 'native'
      ? { ...target, multiSpeakerStrategy: 'segment-and-concat' as const }
      : target
    const { audioPath, metadata: rawMetadata } = singleSpeakerSelection
      ? await runMultiSpeakerTts(input.text, input.workspaceDir, recoveryTarget, executionOptions, attempt.requestEvidence)
      : await target.run(input.text, input.workspaceDir, executionOptions, undefined, attempt.requestEvidence)
    providerRunCompleted = true
    const { _ttsObservedTurns: _ignoredTurns, _ttsRenderStrategy: _ignoredStrategy, ...metadata } = rawMetadata as WorkingTtsMetadata
    if (attempt.executionCheckpointRequired) return buildWorkingTtsResult({ mode: 'generation-checkpoint', metadata, audioPath, audioFileName: rawMetadata.audioFileName, checkpoint: await attempt.finalizeCheckpoint() })
    return buildWorkingTtsResult({ mode: 'provider-render', metadata, reportedOutput, renderArtifacts: await attempt.finalizeSuccess(audioPath, reportedOutput.path) })
  } catch (error) {
    const failure = await attempt.finalizeFailure(error, providerRunCompleted ? 'assembly' : undefined)
    const sanitized = (failure.error as SanitizedProviderError | undefined) ?? sanitizeError(error, providerRunCompleted ? 'assembly' : 'synthesis')
    const providerDiagnostic = sanitized ? [sanitized.message, sanitized.providerMessage && sanitized.providerMessage !== sanitized.message ? sanitized.providerMessage : undefined, sanitized.requestId ? `request_id=${sanitized.requestId}` : undefined].filter((value): value is string => value !== undefined).join(' ') : 'TTS target failed without exposing provider response details.'
    const recoveryDiagnostic = await describeFailedTtsRecovery({ rootDir: recoveryRoot(outputDir, sourceContext), state: failure, target, sourceText: input.text, ttsOptions: options, sourceContext })
    throw InfraError(recoveryDiagnostic ? `${providerDiagnostic} ${recoveryDiagnostic}` : providerDiagnostic, {
      stage: sanitized?.stage ?? `tts:${target.service}`,
      ...(sanitized?.status !== undefined ? { status: sanitized.status } : {}),
      ...(sanitized?.retryable !== undefined ? { retryable: sanitized.retryable } : {}),
      cause: error instanceof Error ? error : new Error(String(error)),
      metadata: sanitized ? { sanitizedProviderError: sanitized } : {},
    })
  }
}

export const runTtsTargets = async (
  targets: TtsTarget[],
  text: string,
  outputDir: string,
  rawOptions: TtsOptions,
  sourceContext?: TtsRunSourceContext | undefined
): Promise<Step4Metadata[]> => await runWithTtsConfigLogScope(async () => {
  validateTtsRenderInputsForTargets(targets, text, rawOptions, sourceContext)
  const readiness = await resolveExecutionReadinessForRun(targets, sourceContext)
  if (readiness.blocked.length > 0) await persistBlockedReadiness({ targets, text, outputDir, options: rawOptions, sourceContext, readiness })
  const options = withRunScopedHostedTtsChunkScheduler(rawOptions)
  const preparedStates = new Map<TtsTarget, PipelineProviderState>()
  const dispatchBarrier = { passed: false }
  const retainedByTargetKey = new Map(sourceContext?.retainedProviderStates?.flatMap(state => state.targetKey ? [[state.targetKey, state] as const] : []) ?? [])
  const prepared = await Promise.all(targets.map(async target => await prepareTargetForExecution({ target, text, outputDir, options, sourceContext, retainedByTargetKey, preparedStates, dispatchBarrier })))
  const attempts = new Map<TtsTarget, CurrentRenderAttempt>()
  const recoveries = new Map<TtsTarget, CompletedRenderRecovery>()
  for (const entry of prepared) {
    if ('attempt' in entry) attempts.set(entry.target, entry.attempt)
    else recoveries.set(entry.target, entry.recovery)
  }
  await publishPreparedStatesBeforeDispatch({ targets, preparedStates, sourceContext, dispatchBarrier })
  return await runTargets<TtsTarget, Step4Metadata>({
    targets,
    outputDir,
    stepLabel: 'TTS',
    noProviderMessage: 'No provider produced audio',
    concurrency: { provider: options.ttsProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY, local: DEFAULT_CLI_CONCURRENCY },
    getTargetPool: () => 'hosted',
    getWorkspaceDir: (dir, target) => `${dir}/.tts-tmp-${target.service}-${sanitizeModelName(target.model)}`,
    useWorkspaceForSingleTarget: true,
    preserveWorkspaceOnFailure: true,
    resourceGate: options.generationResourceGate,
    runTarget: async (target, workspaceDir) => await runPreparedTtsTarget({ target, workspaceDir, targets, text, outputDir, options, sourceContext, attempts, recoveries }),
    finalizeTarget: async (_target, result) => {
      const { _renderArtifacts: _ignoredArtifacts, ...metadata } = result as WorkingTtsResult
      return metadata as Step4Metadata
    },
  })
})

export const runTts = async (
  text: string,
  outputDir: string,
  options: TtsOptions
): Promise<{ audioPaths: string[], metadata: Step4Metadata[] }> => {
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
    const metadata = (await runTtsTargets(wrappedTargets, text, outputDir, options, sourceContext)).map((entry) => ({
      ...entry,
      ...(options.hostedConcurrencyCoordinator ? { hostedConcurrency: options.hostedConcurrencyCoordinator.snapshot() } : {})
    }))
    return {
      audioPaths: metadata.filter((entry) => !entry.generationCheckpoint).map((entry) => getMetadataAudioPath(outputDir, entry)),
      metadata
    }
  }

  const metadata = (await runTtsTargets(targets, text, outputDir, options, sourceContext)).map((entry) => ({
    ...entry,
    ...(options.hostedConcurrencyCoordinator ? { hostedConcurrency: options.hostedConcurrencyCoordinator.snapshot() } : {})
  }))
  return {
    audioPaths: metadata.filter((entry) => !entry.generationCheckpoint).map((entry) => getMetadataAudioPath(outputDir, entry)),
    metadata
  }
}
