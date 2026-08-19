import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type {
  AttemptContext,
  CanonicalAudioProviderProjection,
  ClosedProviderAttempt,
  CurrentTtsRenderArtifacts,
  PipelineProviderState,
  ProviderBatchResult,
  ProviderBatchResultRef,
  ProviderRenderResult,
  ProviderRenderStrategy,
  SanitizedProviderError,
  SuccessPublicationInput,
  WrittenJson,
} from '~/types'
import { AppUsageError, CLIUsageError, InternalError } from '~/utils/error-handler'
import { concatAndConvertToWav } from '../tts-utils/audio-utils'
import {
  hardlinkContainedArtifact,
  readContainedArtifactFile,
} from './safe-artifact-store'
import { hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import { validateProviderRenderResult } from './contract-validation'
import { LOCAL_ACTOR } from './attempt-shared'
import {
  contained,
  copyCreateOnly,
  hasErrorCode,
  publishReportedOutput,
  readObservedAudio,
  writeJson,
  writeJsonCreateOnly,
} from './attempt-io'
import {
  requestedOutput,
  sanitizeError,
  stateForProjection,
  sumCosts,
} from './attempt-planning'
import {
  assembleComicSegmentedAudio,
} from './comic-segmented-audio'
import { resolveRetainedPath } from './recovery-evidence'
import {
  journalEventFields,
  requireJournalFile,
  writeNextJournal,
} from './attempt-journal'
import {
  appendTerminalProjection,
  buildProjection,
  locked,
  publish,
} from './attempt-projection'
import {
  buildBatchProgress,
  promoteBatchResult,
} from './attempt-batches'
import {
  buildAudioMixPlan,
  buildCompactRender,
  buildCompactSlots,
  buildFinalTimeline,
  buildFinalTimelineLayout,
  buildNormalizedTiming,
  buildSpeechSources,
  buildTransformLedger,
} from './attempt-success-builders'
import {
  publishCompactCompletion,
  publishExpandedCompletion,
} from './attempt-success-publication'
export const closeLocalComposition = async (
  ctx: AttemptContext
): Promise<ClosedProviderAttempt> => {
  const { purePlan, options, renderRoot, recoveredBatchFiles } = ctx
  if (!ctx.localCompositionOnly || recoveredBatchFiles.length !== purePlan.planned.slots.length) {
    throw InternalError('Local TTS composition requires one verified recovered result for every generation slot.', { stage: 'tts:recovery' })
  }
  const batchResultFiles = [...recoveredBatchFiles]
    .sort((left, right) => purePlan.planned.slots.findIndex((slot) => slot.generationSlotId === left.value.generationSlotId) - purePlan.planned.slots.findIndex((slot) => slot.generationSlotId === right.value.generationSlotId))
  const batchRefs: ProviderBatchResultRef[] = batchResultFiles.map((file) => ({
    batchId: file.value.batchId,
    generationSlotId: file.value.generationSlotId,
    batchResultId: file.value.batchResultId,
    artifactRef: contained(renderRoot, file.path),
    sha256: file.sha256,
  }))
  const observedRequests = batchResultFiles.flatMap((file) => file.value.observedRequests)
  const requestedTurnIds = purePlan.planned.turns.map((turn) => turn.canonical.turnId)
  const turnOutcomes = requestedTurnIds.map((turnId) => {
    const results = batchResultFiles.map((file) => file.value).filter((result) => result.requestedTurnIds.includes(turnId))
    const requests = results.flatMap((result) => result.observedRequests.filter((request) => request.turns.some((turn) => turn.turnId === turnId)))
    return {
      turnId,
      status: 'succeeded' as const,
      observedRequests: requests.map((request) => ({ invocationId: request.invocationId, requestOrdinal: request.requestOrdinal })),
      batchIds: [...new Set(results.map((result) => result.batchId))],
      generationSlotIds: results.map((result) => result.generationSlotId),
      outputIds: results.flatMap((result) => result.outputs.map((output) => output.outputId)),
    }
  })
  const compositionId = hashCanonicalTtsValue({ renderPlanId: purePlan.renderPlanId, renderIdentity: purePlan.renderIdentity, batchResults: batchRefs })
  const renderResult = {
    schemaVersion: 1 as const,
    closedBy: { kind: 'local-composition' as const, compositionId },
    renderPlanId: purePlan.renderPlanId,
    renderIdentity: purePlan.renderIdentity,
    status: 'succeeded' as const,
    requestedTurnIds,
    batchResults: batchRefs,
    observedRequests,
    outputs: batchResultFiles.flatMap((file) => file.value.outputs.map((output) => ({ ...output, batchResultId: file.value.batchResultId }))),
    generatedBatches: batchResultFiles.flatMap((file) => file.value.generatedBatch ? [file.value.generatedBatch] : []),
    turnOutcomes,
    createdResources: batchResultFiles.flatMap((file) => file.value.createdResources),
    retryAttempts: batchResultFiles.flatMap((file) => file.value.retryAttempts),
    cost: {
      currentComposition: { planned: purePlan.plannedRenderCost, observed: [] },
      closingAttempt: { planned: { amounts: [] }, observed: [] },
      cumulativeRenderHistory: { planned: sumCosts(batchResultFiles.map((file) => file.value.cost.planned)), observed: [] },
    },
    resultIdentity: hashCanonicalTtsValue({
      schemaVersion: 1,
      closedBy: { kind: 'local-composition', compositionId },
      renderPlanId: purePlan.renderPlanId,
      renderIdentity: purePlan.renderIdentity,
      status: 'succeeded',
      requestedTurnIds,
      batchResults: batchRefs,
      observedRequests,
      outputs: batchResultFiles.flatMap((file) => file.value.outputs.map((output) => ({ ...output, batchResultId: file.value.batchResultId }))),
      generatedBatches: batchResultFiles.flatMap((file) => file.value.generatedBatch ? [file.value.generatedBatch] : []),
      turnOutcomes,
      createdResources: batchResultFiles.flatMap((file) => file.value.createdResources),
      retryAttempts: batchResultFiles.flatMap((file) => file.value.retryAttempts),
      cost: {
        currentComposition: { planned: purePlan.plannedRenderCost, observed: [] },
        closingAttempt: { planned: { amounts: [] }, observed: [] },
        cumulativeRenderHistory: { planned: sumCosts(batchResultFiles.map((file) => file.value.cost.planned)), observed: [] },
      },
    }),
  } as ProviderRenderResult
  validateProviderRenderResult(renderResult)
  const resultFile = await writeJsonCreateOnly(options.outputDir, `${renderRoot}/compositions/${compositionId}/provider-render-result.json`, renderResult)
  return { resultFile, batchResultFiles }
}

export const closeProviderAttempt = async (
  ctx: AttemptContext,
  closingError?: SanitizedProviderError | undefined
): Promise<ClosedProviderAttempt> => {
  if (ctx.closedProviderAttempt) return ctx.closedProviderAttempt
  return await locked(ctx, async () => {
    if (ctx.closedProviderAttempt) return ctx.closedProviderAttempt
    const { purePlan, options, renderRoot, attemptRoot, attemptNumber, invocationId, runtimeRequests, recoveredBatchFiles } = ctx
    const touchedSlots = purePlan.planned.slots.filter((slot) => runtimeRequests.some((entry) => entry.slot.generationSlotId === slot.generationSlotId))
    if (touchedSlots.length === 0) {
      throw InternalError('A provider attempt cannot close before serializer dispatch.', { stage: 'tts:admission' })
    }
    const currentBatchResultFiles: Array<WrittenJson<ProviderBatchResult>> = []
    for (const slot of touchedSlots) {
      currentBatchResultFiles.push(await promoteBatchResult(ctx, slot, closingError))
    }
    const batchResultFiles = [...recoveredBatchFiles, ...currentBatchResultFiles]
      .filter((file, index, files) => files.findIndex((candidate) => candidate.value.generationSlotId === file.value.generationSlotId) === index)
      .sort((left, right) => purePlan.planned.slots.findIndex((slot) => slot.generationSlotId === left.value.generationSlotId) - purePlan.planned.slots.findIndex((slot) => slot.generationSlotId === right.value.generationSlotId))
    const batchRefs: ProviderBatchResultRef[] = batchResultFiles.map((file) => ({
      batchId: file.value.batchId,
      generationSlotId: file.value.generationSlotId,
      batchResultId: file.value.batchResultId,
      artifactRef: contained(renderRoot, file.path),
      sha256: file.sha256,
    }))
    const allObserved = batchResultFiles.flatMap((file) => file.value.observedRequests)
    const requestedTurnIds = purePlan.planned.turns.map((turn) => turn.canonical.turnId)
    const turnOutcomes = requestedTurnIds.map((turnId) => {
      const results = batchResultFiles.map((file) => file.value).filter((result) => result.requestedTurnIds.includes(turnId))
      const expectedSlotIds = purePlan.planned.slots.filter((slot) => slot.turnIds.includes(turnId)).map((slot) => slot.generationSlotId)
      const completedSlotIds = new Set(results.map((result) => result.generationSlotId))
      const status = results.some((result) => result.status === 'ambiguous')
        ? 'ambiguous' as const
        : results.some((result) => result.status === 'failed' || result.status === 'partial')
          ? 'failed' as const
          : expectedSlotIds.every((slotId) => completedSlotIds.has(slotId))
            ? 'succeeded' as const
            : 'unstarted' as const
      const linkedRequests = allObserved.filter((request) => request.turns.some((turn) => turn.turnId === turnId))
      return {
        turnId,
        status,
        observedRequests: linkedRequests.map((request) => ({ invocationId: request.invocationId, requestOrdinal: request.requestOrdinal })),
        batchIds: results.map((result) => result.batchId),
        generationSlotIds: results.map((result) => result.generationSlotId),
        outputIds: status === 'succeeded' ? results.flatMap((result) => result.outputs.map((output) => output.outputId)) : [],
        ...(status === 'succeeded' ? {} : {
          error: closingError ?? {
            phase: 'synthesis' as const,
            code: status === 'unstarted' ? 'generation_slot_unstarted' : status === 'ambiguous' ? 'provider_outcome_ambiguous' : 'provider_request_failed',
            message: status === 'unstarted' ? 'Generation slot was not dispatched.' : status === 'ambiguous' ? 'Provider admission outcome is ambiguous.' : 'Provider request failed.',
            retryable: status !== 'failed',
          },
        }),
      }
    })
    const succeededCount = turnOutcomes.filter((outcome) => outcome.status === 'succeeded').length
    const status = succeededCount === requestedTurnIds.length
      ? 'succeeded' as const
      : succeededCount > 0
        ? 'partial' as const
        : turnOutcomes.some((outcome) => outcome.status === 'ambiguous')
          ? 'ambiguous' as const
          : 'failed' as const
    const renderResultBase = {
      schemaVersion: 1 as const,
      closedBy: { kind: 'provider-attempt' as const, invocationId, attempt: attemptNumber },
      renderPlanId: purePlan.renderPlanId,
      renderIdentity: purePlan.renderIdentity,
      status,
      requestedTurnIds,
      batchResults: batchRefs,
      observedRequests: allObserved,
      outputs: batchResultFiles.flatMap((file) => file.value.outputs.map((output) => ({ ...output, batchResultId: file.value.batchResultId }))),
      generatedBatches: batchResultFiles.flatMap((file) => file.value.generatedBatch ? [file.value.generatedBatch] : []),
      turnOutcomes,
      createdResources: [],
      retryAttempts: batchResultFiles.flatMap((file) => file.value.retryAttempts),
      cost: {
        currentComposition: { planned: purePlan.plannedRenderCost, observed: [] },
        closingAttempt: { planned: ctx.unresolvedPlannedCost, observed: [] },
        cumulativeRenderHistory: { planned: ctx.cumulativePlannedCost, observed: [] },
      },
      ...(status === 'succeeded' ? {} : {
        error: closingError ?? {
          phase: 'synthesis' as const,
          code: status === 'ambiguous' ? 'provider_outcome_ambiguous' : 'tts_target_failed',
          message: status === 'ambiguous' ? 'Provider admission outcome is ambiguous.' : 'TTS target failed.',
          retryable: status === 'ambiguous',
        },
      }),
    }
    const renderResult = {
      ...renderResultBase,
      resultIdentity: hashCanonicalTtsValue(renderResultBase),
    } as ProviderRenderResult
    validateProviderRenderResult(renderResult)
    const resultFile = await writeJson(options.outputDir, `${attemptRoot}/provider-render-result.json`, renderResult)
    await writeNextJournal(ctx, {
      ...ctx.journal,
      previousSnapshotId: ctx.journal.snapshotId,
      recordedResult: {
        resultIdentity: renderResult.resultIdentity,
        resultRef: contained(attemptRoot, resultFile.path),
        resultSha256: resultFile.sha256,
        batchResultSetHash: hashCanonicalTtsValue(batchRefs),
      },
      capturedAt: ctx.now(),
    })
    ctx.closedProviderAttempt = { resultFile, batchResultFiles }
    return ctx.closedProviderAttempt
  })
}

export const finalizeFailure = async (
  ctx: AttemptContext,
  error: unknown,
  phase?: SanitizedProviderError['phase']
): Promise<PipelineProviderState> => {
  if (ctx.terminalState) return ctx.terminalState
  const sanitized = sanitizeError(error, phase ?? (ctx.runtimeRequests.length > 0 ? 'synthesis' : 'static-validation'))
  if (ctx.runtimeRequests.length === 0) {
    const at = ctx.now()
    ctx.events.push({ sequence: ctx.events.length + 1, status: 'failed', at, attempt: ctx.priorAttemptCount, error: sanitized })
    ctx.pointerEvents.push({ sequence: ctx.pointerEvents.length + 1, action: 'activate-render', renderIdentity: ctx.purePlan.renderIdentity, eventSequence: ctx.events.length, actor: LOCAL_ACTOR, at })
    ctx.currentProjection = buildProjection(ctx)
    ctx.terminalState = stateForProjection(ctx.options.target, ctx.purePlan.targetKey, ctx.purePlan.transport, ctx.targetRelativeDir, ctx.currentProjection, sanitized)
    await publish(ctx, ctx.terminalState)
    return ctx.terminalState
  }
  let resultFile: WrittenJson<ProviderRenderResult> | undefined
  let batchResultFiles: Array<WrittenJson<ProviderBatchResult>> = []
  try {
    const closed = await closeProviderAttempt(ctx, sanitized)
    resultFile = closed.resultFile
    batchResultFiles = closed.batchResultFiles
  } catch (evidenceError) {
    const evidenceFailure = sanitizeError(evidenceError, 'reconciliation')
    sanitized.message = `${sanitized.message}; evidence finalization: ${evidenceFailure.message}`.slice(0, 600)
  }
  ctx.currentProjection = appendTerminalProjection(ctx, 'failed', { result: resultFile, batchResultFiles, error: sanitized })
  ctx.terminalState = stateForProjection(ctx.options.target, ctx.purePlan.targetKey, ctx.purePlan.transport, ctx.targetRelativeDir, ctx.currentProjection, sanitized)
  await publish(ctx, ctx.terminalState)
  return ctx.terminalState
}

const assembleMasteredAudio = async (
  ctx: AttemptContext,
  batchResultFiles: Array<WrittenJson<ProviderBatchResult>>,
  audioPath: string,
  masteringDir: string
): Promise<string> => {
  const { options, purePlan } = ctx
  const masteringProfile = options.ttsOptions.ttsMasteringProfile
  if (options.comicContext && purePlan.planned.strategy === 'segmented') {
    if (!masteringProfile) throw CLIUsageError('Comic segmented assembly requires an explicit mastering profile.')
    const resultBySlot = new Map(batchResultFiles.map((file) => [file.value.generationSlotId, file] as const))
    const outputPathsBySlot = new Map<string, readonly string[]>(purePlan.planned.slots.map((slot) => {
      const file = resultBySlot.get(slot.generationSlotId)
      if (!file) throw CLIUsageError(`Comic assembly is missing generation slot ${slot.generationSlotId}.`)
      return [
        slot.generationSlotId,
        file.value.outputs.map((output) => resolveRetainedPath(output.artifactRef.includes('/') ? options.outputDir : dirname(file.path), output.artifactRef, `Comic generation slot ${slot.generationSlotId} provider output`)),
      ] as const
    }))
    return await assembleComicSegmentedAudio({
      dialoguePlan: options.comicContext.dialoguePlan,
      turns: purePlan.planned.turns.map((turn) => turn.canonical),
      slots: purePlan.planned.slots,
      outputPathsBySlot,
      masteringDir,
      providerLabel: options.target.service,
      profile: masteringProfile,
    })
  }
  if (ctx.localCompositionOnly && purePlan.planned.strategy === 'segmented') {
    const recoveredOutputPaths = batchResultFiles.flatMap((file) =>
      file.value.outputs.map((output) => resolveRetainedPath(output.artifactRef.includes('/') ? options.outputDir : dirname(file.path), output.artifactRef, `Recovered generation slot ${file.value.generationSlotId} provider output`))
    )
    return await concatAndConvertToWav(recoveredOutputPaths, masteringDir, `${options.target.service}-recovery-mastering`, undefined, masteringProfile)
  }
  return await concatAndConvertToWav([audioPath], masteringDir, `${options.target.service}-mastering`, undefined, masteringProfile)
}

const publishReportedAudio = async (
  ctx: AttemptContext,
  masteredPath: string,
  reportedOutputPath: string
): Promise<string> => {
  const { outputDir } = ctx.options
  if (resolve(masteredPath) === resolve(reportedOutputPath)) {
    return sha256Bytes((await readContainedArtifactFile(
      outputDir,
      contained(outputDir, reportedOutputPath)
    )).bytes)
  }
  try {
    const file = await hardlinkContainedArtifact(
      outputDir,
      contained(outputDir, masteredPath),
      contained(outputDir, reportedOutputPath)
    )
    return file.sha256
  } catch (error) {
    const mayCopy = error instanceof AppUsageError
      || ['EXDEV', 'EPERM', 'EACCES', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS']
        .some((code) => hasErrorCode(error, code))
    if (!mayCopy) throw error
    return await publishReportedOutput(
      outputDir,
      masteredPath,
      reportedOutputPath,
      ctx.currentProjection
    )
  }
}

const requireSuccessPreconditions = (ctx: AttemptContext): void => {
  if (ctx.terminalState) throw CLIUsageError('TTS render attempt was already finalized.')
  if (ctx.requestedSlotLimit !== undefined && !ctx.localCompositionOnly) {
    throw CLIUsageError('A bounded TTS generation checkpoint cannot publish a complete audio run.')
  }
  if (
    (!ctx.localCompositionOnly && ctx.runtimeRequests.length === 0)
    || ctx.purePlan.planned.slots.some((slot) =>
      !ctx.recoveredBySlot.has(slot.generationSlotId)
      && !(ctx.outputsBySlot.get(slot.generationSlotId)?.length))
  ) {
    throw CLIUsageError('TTS target returned success without serializer-observed or verified recovered output for every planned generation slot.')
  }
}

export const finalizeSuccess = async (
  ctx: AttemptContext,
  audioPath: string,
  reportedOutputPath: string
): Promise<CurrentTtsRenderArtifacts> => {
  requireSuccessPreconditions(ctx)
  const { options, purePlan, renderRoot, attemptRoot, paidSpeechSlotHash } = ctx
  const { resultFile, batchResultFiles } = ctx.localCompositionOnly
    ? await closeLocalComposition(ctx)
    : await closeProviderAttempt(ctx)
  if (!resultFile || resultFile.value.status !== 'succeeded') {
    throw CLIUsageError('TTS provider attempt did not close as a complete success.')
  }

  const audioRunRoot = `${renderRoot}/results/${resultFile.value.resultIdentity}/audio-run`
  const finalPath = `${audioRunRoot}/final.wav`
  const masteringDir = ctx.localCompositionOnly ? `${dirname(resultFile.path)}/mastering` : `${attemptRoot}/mastering`
  await mkdir(masteringDir, { recursive: true })
  const masteredPath = await assembleMasteredAudio(ctx, batchResultFiles, audioPath, masteringDir)
  await copyCreateOnly(options.outputDir, masteredPath, finalPath)
  const finalAudio = await readObservedAudio(options.outputDir, finalPath)
  const finalAudioSha256 = sha256Bytes(finalAudio.bytes)
  const speechSources = buildSpeechSources(resultFile.value)
  const mixPlan = buildAudioMixPlan({
    renderIdentity: purePlan.renderIdentity,
    outputProfileHash: purePlan.outputProfileHash,
    strategy: purePlan.planned.strategy,
    requestedOutput: requestedOutput(options),
    dialogueNodes: purePlan.planned.dialoguePlan.nodes,
    comicSegmented: Boolean(options.comicContext) && purePlan.planned.strategy === 'segmented',
    sources: speechSources,
    createdAt: ctx.now(),
  })
  const mixPlanFile = await writeJson(options.outputDir, `${audioRunRoot}/mix-plan.json`, mixPlan)
  const timelineLayout = buildFinalTimelineLayout({
    turns: purePlan.planned.turns,
    slots: purePlan.planned.slots,
    batchResultFiles,
    comicDialoguePlan: options.comicContext?.dialoguePlan,
  })
  const ledger = buildTransformLedger({
    renderIdentity: purePlan.renderIdentity,
    requestedOutput: requestedOutput(options),
    sources: speechSources,
    finalDurationMs: finalAudio.durationMs,
    turns: purePlan.planned.turns,
    timelineLayout,
  })
  const ledgerFile = await writeJson(options.outputDir, `${audioRunRoot}/transform-ledger.json`, ledger)
  const timing = buildNormalizedTiming({
    strategy: purePlan.planned.strategy,
    turns: purePlan.planned.turns,
    batchResultFiles,
    assembledTurns: timelineLayout.turns,
  })
  const timeline = buildFinalTimeline({
    renderIdentity: purePlan.renderIdentity,
    timing,
    speechSources,
    transformLedgerRef: {
      path: contained(audioRunRoot, ledgerFile.path),
      sha256: ledgerFile.sha256,
    },
  })
  const reportedOutputSha256 = await publishReportedAudio(
    ctx,
    masteredPath,
    reportedOutputPath
  )
  const compactSlots = buildCompactSlots({
    slots: purePlan.planned.slots,
    turns: purePlan.planned.turns,
    batchResultFiles,
    paidSpeechSlotHash,
  })
  const compactRender = buildCompactRender({
    targetKey: purePlan.targetKey,
    renderIdentity: purePlan.renderIdentity,
    renderPlanId: purePlan.renderPlanId,
    dialoguePlanId: purePlan.planned.dialoguePlan.dialoguePlanId,
    snapshotId: options.comicContext?.voiceSnapshot.snapshotId,
    strategy: purePlan.planned.strategy,
    finalAudio,
    result: resultFile.value,
    slots: compactSlots,
    reportedOutputRef: contained(options.outputDir, reportedOutputPath),
    finalAudioSha256,
  })
  const publication: SuccessPublicationInput = {
    ctx, resultFile, batchResultFiles, audioRunRoot, finalPath, finalAudio,
    finalAudioSha256, reportedOutputPath, reportedOutputSha256,
    mixPlan, mixPlanFile, ledger, ledgerFile, timeline, compactSlots, compactRender,
  }
  return !ctx.compactArchive || ctx.localCompositionOnly || Boolean(options.comicContext)
    ? await publishExpandedCompletion(publication)
    : await publishCompactCompletion(publication)
}

export const finalizeCheckpoint = async (ctx: AttemptContext): Promise<{
  artifactDir: string
  operation: 'tts-synthesis' | 'comic-audio'
  targetKey: string
  transport: string
  renderIdentity: string
  strategy: ProviderRenderStrategy
  projection: CanonicalAudioProviderProjection
  completedGenerationSlotIds: string[]
  remainingGenerationSlotCount: number
}> => {
  const { options, purePlan, attemptSlots, targetDir, targetRelativeDir, attemptNumber, recoveredBySlot } = ctx
  if (ctx.terminalState) throw CLIUsageError('TTS render attempt was already finalized.')
  if (ctx.requestedSlotLimit === undefined) throw CLIUsageError('An unbounded TTS render cannot finalize as a generation checkpoint.')
  if (
    ctx.runtimeRequests.length === 0
    || attemptSlots.some((slot) => !(ctx.outputsBySlot.get(slot.generationSlotId)?.length))
  ) {
    throw CLIUsageError('Bounded TTS execution did not durably complete every admitted generation slot.')
  }
  const checkpointReason: SanitizedProviderError = {
    phase: 'synthesis',
    code: 'generation_slot_limit_reached',
    message: `Bounded TTS execution completed ${attemptSlots.length} generation slot(s); the immutable render remains incomplete.`,
    retryable: true,
  }
  const { resultFile, batchResultFiles } = await closeProviderAttempt(ctx, checkpointReason)
  if (!resultFile || (resultFile.value.status !== 'partial' && resultFile.value.status !== 'succeeded')) {
    throw CLIUsageError('Bounded TTS generation checkpoint did not close with durable successful slot evidence.')
  }
  const at = ctx.now()
  requireJournalFile(ctx)
  ctx.events.push({
    sequence: ctx.events.length + 1,
    status: 'running',
    at,
    attempt: attemptNumber,
    ...journalEventFields(ctx),
    providerRenderResultIdentity: resultFile.value.resultIdentity,
    providerRenderResultRef: contained(targetDir, resultFile.path),
    providerRenderResultSha256: resultFile.sha256,
    batchProgress: buildBatchProgress(ctx, batchResultFiles),
  })
  ctx.pointerEvents.push({
    sequence: ctx.pointerEvents.length + 1,
    action: 'activate-render',
    renderIdentity: purePlan.renderIdentity,
    eventSequence: ctx.events.length,
    actor: LOCAL_ACTOR,
    at,
  })
  ctx.currentProjection = buildProjection(ctx)
  ctx.terminalState = stateForProjection(options.target, purePlan.targetKey, purePlan.transport, targetRelativeDir, ctx.currentProjection)
  await publish(ctx, ctx.terminalState)
  const completedGenerationSlotIds = [...new Set([
    ...recoveredBySlot.keys(),
    ...attemptSlots.map((slot) => slot.generationSlotId),
  ])]
  return {
    artifactDir: targetRelativeDir,
    operation: purePlan.operation,
    targetKey: purePlan.targetKey,
    transport: purePlan.transport,
    renderIdentity: purePlan.renderIdentity,
    strategy: purePlan.planned.strategy,
    projection: ctx.currentProjection,
    completedGenerationSlotIds,
    remainingGenerationSlotCount: purePlan.planned.slots.length - completedGenerationSlotIds.length,
  }
}
