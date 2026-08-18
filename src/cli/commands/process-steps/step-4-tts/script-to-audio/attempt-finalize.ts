import { mkdir, readdir, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type {
  AudioRun,
  CanonicalAudioProviderProjection,
  CompactAudioArchive,
  CompactTargetRender,
  PipelineProviderState,
  ProviderBatchResult,
  ProviderBatchResultRef,
  ProviderRenderResult,
  ProviderRenderStrategy,
  SanitizedProviderError,
} from '~/types'
import { CLIUsageError, InternalError } from '~/utils/error-handler'
import { concatAndConvertToWav } from '../tts-utils/audio-utils'
import {
  hardlinkContainedArtifact,
  readContainedArtifactFile,
  removeContainedDirectory,
} from './safe-artifact-store'
import { hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import { validateProviderRenderResult } from './contract-validation'
import { LOCAL_ACTOR, type WrittenJson } from './attempt-shared'
import {
  contained,
  copyCreateOnly,
  publishReportedOutput,
  readObservedAudio,
  writeJson,
  writeJsonCreateOnly,
  writeJsonReplace,
} from './attempt-io'
import {
  requestedOutput,
  sanitizeError,
  stateForProjection,
  sumCosts,
} from './attempt-planning'
import {
  assembleComicSegmentedAudio,
  comicTimelineLayout,
  localVoiceEffectFilter,
} from './comic-segmented-audio'
import { resolveRetainedPath } from './attempt-recovery'
import type { AttemptContext, ClosedProviderAttempt } from './attempt-context'
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
import type { CurrentTtsRenderArtifacts } from './current-render-artifacts'

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

export const finalizeSuccess = async (
  ctx: AttemptContext,
  audioPath: string,
  reportedOutputPath: string
): Promise<CurrentTtsRenderArtifacts> => {
  const {
    options,
    purePlan,
    renderRoot,
    targetDir,
    targetRelativeDir,
    archiveRelativeDir,
    layout,
    compactArchive,
    attemptRoot,
    recoveredBySlot,
    paidSpeechSlotHash,
  } = ctx
  if (ctx.terminalState) throw CLIUsageError('TTS render attempt was already finalized.')
  if (ctx.requestedSlotLimit !== undefined && !ctx.localCompositionOnly) {
    throw CLIUsageError('A bounded TTS generation checkpoint cannot publish a complete audio run.')
  }
  if (
    (!ctx.localCompositionOnly && ctx.runtimeRequests.length === 0)
    || purePlan.planned.slots.some((slot) => !recoveredBySlot.has(slot.generationSlotId) && !(ctx.outputsBySlot.get(slot.generationSlotId)?.length))
  ) {
    throw CLIUsageError('TTS target returned success without serializer-observed or verified recovered output for every planned generation slot.')
  }
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
  const speechSources = resultFile.value.outputs.map((output) => ({
    kind: 'provider-output' as const,
    sourceId: output.outputId,
    resultIdentity: resultFile.value.resultIdentity,
    batchResultId: output.batchResultId,
    outputId: output.outputId,
    artifactRef: output.artifactRef,
    sha256: output.sha256,
  }))
  const assemblyParametersHash = hashCanonicalTtsValue({
    sourceIds: speechSources.map((source) => source.sourceId),
    strategy: purePlan.planned.strategy,
    requestedOutput: requestedOutput(options),
    dialogueNodes: purePlan.planned.dialoguePlan.nodes,
  })
  const mixPlanBase = {
    schemaVersion: 1 as const,
    renderIdentity: purePlan.renderIdentity,
    outputProfileHash: purePlan.outputProfileHash,
    sources: speechSources,
    operations: [{
      kind: options.comicContext && purePlan.planned.strategy === 'segmented'
        ? 'dialogue-node-assembly'
        : speechSources.length > 1 ? 'ordered-concat' : 'single-source',
      parametersHash: assemblyParametersHash,
    }],
    createdAt: ctx.now(),
  }
  const mixPlan = {
    ...mixPlanBase,
    mixPlanId: hashCanonicalTtsValue(mixPlanBase),
  }
  const mixPlanFile = await writeJson(options.outputDir, `${audioRunRoot}/mix-plan.json`, mixPlan)
  const transcodeParametersHash = hashCanonicalTtsValue({ ...requestedOutput(options), orderedConcat: speechSources.length > 1 })
  const transformOperation = {
    operationId: hashCanonicalTtsValue({ kind: 'transcode', transcodeParametersHash, finalDurationMs: finalAudio.durationMs }),
    kind: 'transcode' as const,
    finalRangeMs: { start: 0, end: finalAudio.durationMs },
    parametersHash: transcodeParametersHash,
  }
  const turnDuration = (turnId: string): number => {
    return batchResultFiles
      .filter((file) => file.value.requestedTurnIds.length === 1 && file.value.requestedTurnIds[0] === turnId)
      .flatMap((file) => file.value.outputs)
      .reduce((sum, output) => sum + (output.durationMs ?? 0), 0)
  }
  const timingSegmentDuration = (turnId: string, segmentIndex: number): number => {
    const slotIds = new Set(purePlan.planned.slots.filter((slot) => slot.turnIds.length === 1 && slot.turnIds[0] === turnId && (slot.timingSegmentIndex ?? 0) === segmentIndex).map((slot) => slot.generationSlotId))
    return batchResultFiles.filter((file) => slotIds.has(file.value.generationSlotId)).flatMap((file) => file.value.outputs).reduce((sum, output) => sum + (output.durationMs ?? 0), 0)
  }
  const timelineLayout = options.comicContext ? comicTimelineLayout(options.comicContext.dialoguePlan, turnDuration, timingSegmentDuration) : undefined
  let genericTimelineCursorMs = 0
  const assembledTurns = timelineLayout?.turns ?? purePlan.planned.turns.map((turn) => {
    const startMs = genericTimelineCursorMs
    genericTimelineCursorMs += turnDuration(turn.canonical.turnId)
    return { turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, startMs, endMs: genericTimelineCursorMs }
  })
  const effectOperations = assembledTurns.flatMap((assembled) => {
    const turn = purePlan.planned.turns.find((candidate) => candidate.canonical.turnId === assembled.turnId)?.canonical
    if (!turn?.effect || !localVoiceEffectFilter(turn)) return []
    const parametersHash = hashCanonicalTtsValue(turn.effect)
    return [{ operationId: hashCanonicalTtsValue({ kind: 'effect', turnId: assembled.turnId, parametersHash, finalRangeMs: { start: assembled.startMs, end: assembled.endMs } }), kind: 'effect' as const, finalRangeMs: { start: assembled.startMs, end: assembled.endMs }, parametersHash }]
  })
  const overlapOperations = (timelineLayout?.overlaps ?? []).map((overlap) => {
    const parametersHash = hashCanonicalTtsValue({ groupId: overlap.groupId })
    return { operationId: hashCanonicalTtsValue({ kind: 'overlap', groupId: overlap.groupId, parametersHash, finalRangeMs: { start: overlap.start, end: overlap.end } }), kind: 'overlap' as const, finalRangeMs: { start: overlap.start, end: overlap.end }, parametersHash }
  })
  const pauseOperations = (timelineLayout?.pauses ?? []).map((pause) => {
    const parametersHash = hashCanonicalTtsValue(pause.parameters)
    return { operationId: hashCanonicalTtsValue({ kind: 'pause', parametersHash, finalRangeMs: { start: pause.start, end: pause.end } }), kind: 'pause' as const, finalRangeMs: { start: pause.start, end: pause.end }, parametersHash }
  })
  const ledgerBase = { schemaVersion: 1 as const, renderIdentity: purePlan.renderIdentity, operations: [transformOperation, ...effectOperations, ...overlapOperations, ...pauseOperations] }
  const ledger = {
    ...ledgerBase,
    transformLedgerId: hashCanonicalTtsValue(ledgerBase),
  }
  const ledgerFile = await writeJson(options.outputDir, `${audioRunRoot}/transform-ledger.json`, ledger)
  const hasAssembledTurnTiming = purePlan.planned.strategy === 'segmented' && assembledTurns.every((turn) => turn.endMs > turn.startMs)
  let nativeCursorMs = 0
  const nativeTimingParts = batchResultFiles.map((file) => {
    const take = file.value.generatedBatch?.takes[0]
    const timing = take?.timing
    const offsetMs = nativeCursorMs
    nativeCursorMs += take?.durationMs ?? file.value.outputs[0]?.durationMs ?? 0
    if (!timing || timing.availability !== 'timed') return undefined
    const shiftToken = (token: NonNullable<typeof timing.words>[number]) => ({ ...token, startMs: token.startMs + offsetMs, endMs: token.endMs + offsetMs })
    return {
      provenance: timing.provenance,
      turns: timing.turns.map((turn) => ({ ...turn, startMs: turn.startMs + offsetMs, endMs: turn.endMs + offsetMs })),
      words: timing.words?.map(shiftToken) ?? [],
      phonemes: timing.phonemes?.map(shiftToken) ?? [],
      characters: timing.characters?.map(shiftToken) ?? [],
    }
  })
  const hasNativeTiming = purePlan.planned.strategy !== 'segmented' && nativeTimingParts.length > 0 && nativeTimingParts.every((part) => part !== undefined)
  const nativeTiming = hasNativeTiming
    ? {
        availability: 'timed' as const,
        clock: 'final-audio-ms' as const,
        provenance: nativeTimingParts.some((part) => part?.provenance === 'provider-alignment') ? 'provider-alignment' as const : 'provider-native' as const,
        turns: nativeTimingParts.flatMap((part) => part?.turns ?? []),
        ...(nativeTimingParts.some((part) => (part?.words.length ?? 0) > 0) ? { words: nativeTimingParts.flatMap((part) => part?.words ?? []) } : {}),
        ...(nativeTimingParts.some((part) => (part?.phonemes.length ?? 0) > 0) ? { phonemes: nativeTimingParts.flatMap((part) => part?.phonemes ?? []) } : {}),
        ...(nativeTimingParts.some((part) => (part?.characters.length ?? 0) > 0) ? { characters: nativeTimingParts.flatMap((part) => part?.characters ?? []) } : {}),
      }
    : undefined
  const timelineBase = {
    schemaVersion: 1 as const,
    renderIdentity: purePlan.renderIdentity,
    timing: nativeTiming ?? (hasAssembledTurnTiming
      ? { availability: 'timed' as const, clock: 'final-audio-ms' as const, provenance: 'assembled-segments' as const, turns: assembledTurns }
      : { availability: 'unavailable' as const, clock: 'final-audio-ms' as const, provenance: 'unavailable' as const, turns: purePlan.planned.turns.map((turn) => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey })), reason: 'Native/provider timing was not exposed at exact turn boundaries.' }),
    speechSources,
    transformLedgerRef: { path: contained(audioRunRoot, ledgerFile.path), sha256: ledgerFile.sha256 },
  }
  const timeline = {
    ...timelineBase,
    timelineId: hashCanonicalTtsValue(timelineBase),
  }
  const reportedOutputSha256 = resolve(masteredPath) === resolve(reportedOutputPath)
    ? sha256Bytes((await readContainedArtifactFile(options.outputDir, contained(options.outputDir, reportedOutputPath))).bytes)
    : await hardlinkContainedArtifact(options.outputDir, contained(options.outputDir, masteredPath), contained(options.outputDir, reportedOutputPath))
      .then((file) => file.sha256)
      .catch(async () => await publishReportedOutput(options.outputDir, masteredPath, reportedOutputPath, ctx.currentProjection))

  if (!compactArchive || ctx.localCompositionOnly || options.comicContext) {
    const timelineFile = await writeJson(options.outputDir, `${audioRunRoot}/final-timeline.json`, timeline)
    const audioRunBase = {
      schemaVersion: 1 as const,
      targetKey: purePlan.targetKey,
      renderPlanId: purePlan.renderPlanId,
      renderIdentity: purePlan.renderIdentity,
      providerResult: { resultIdentity: resultFile.value.resultIdentity, path: contained(renderRoot, resultFile.path), sha256: resultFile.sha256 },
      takeSelections: [],
      continuationCheckpoints: [],
      mixPlan: { mixPlanId: mixPlan.mixPlanId, path: contained(audioRunRoot, mixPlanFile.path), sha256: mixPlanFile.sha256 },
      transformLedger: { transformLedgerId: ledger.transformLedgerId, path: contained(audioRunRoot, ledgerFile.path), sha256: ledgerFile.sha256 },
      finalTimeline: { timelineId: timeline.timelineId, path: contained(audioRunRoot, timelineFile.path), sha256: timelineFile.sha256 },
      finalOutputs: [{ path: contained(audioRunRoot, finalPath), sha256: sha256Bytes(finalAudio.bytes), format: finalAudio.format, durationMs: finalAudio.durationMs }],
      createdAt: ctx.now(),
    }
    const audioRun = {
      ...audioRunBase,
      audioRunId: hashCanonicalTtsValue(audioRunBase),
    } as AudioRun
    const audioRunFile = await writeJson(options.outputDir, `${audioRunRoot}/audio-run.json`, audioRun)
    const archiveTimelineFile = await writeJsonReplace(options.outputDir, `${options.outputDir}/${layout.archiveTimelinePath}`, timeline)
    const compactSlots = purePlan.planned.slots.map((slot) => {
      const file = batchResultFiles.find((entry) => entry.value.generationSlotId === slot.generationSlotId)
      const output = file?.value.outputs[0]
      if (!output) throw CLIUsageError(`Compact TTS render is missing paid output for ${slot.generationSlotId}.`)
      return {
        slotHash: paidSpeechSlotHash(slot),
        turnIds: [...slot.turnIds],
        sha256: output.sha256,
        durationMs: output.durationMs ?? 0,
        voiceHash: hashCanonicalTtsValue(slot.turnIds.map((turnId) => purePlan.planned.turns.find((turn) => turn.canonical.turnId === turnId)?.voice.valueHash ?? '')),
      }
    })
    const compactRenderBase = {
      schemaVersion: 1 as const,
      targetKey: purePlan.targetKey,
      renderIdentity: purePlan.renderIdentity,
      renderPlanId: purePlan.renderPlanId,
      dialoguePlanId: purePlan.planned.dialoguePlan.dialoguePlanId,
      ...(options.comicContext ? { snapshotId: options.comicContext.voiceSnapshot.snapshotId } : {}),
      strategy: purePlan.planned.strategy,
      format: finalAudio.format,
      cost: resultFile.value.cost,
      slots: compactSlots,
      outputs: {
        final: {
          path: contained(options.outputDir, reportedOutputPath),
          sha256: sha256Bytes(finalAudio.bytes),
          durationMs: finalAudio.durationMs,
        },
      },
      retryErrorSummary: {
        requestCount: resultFile.value.observedRequests.length,
        retryCount: resultFile.value.retryAttempts.length,
        failedSlotCount: 0,
      },
    }
    const compactRender = {
      ...compactRenderBase,
      renderId: hashCanonicalTtsValue(compactRenderBase),
    } as unknown as CompactTargetRender
    const compactRenderFile = await writeJsonReplace(options.outputDir, `${options.outputDir}/${layout.archiveRenderPath}`, compactRender)
    ctx.currentProjection = appendTerminalProjection(ctx, 'succeeded', {
      result: resultFile,
      audioRun: audioRunFile,
      batchResultFiles,
      outputRefs: [{ path: contained(targetDir, finalPath), sha256: sha256Bytes(finalAudio.bytes) }],
      reportedOutputRefs: [{ path: contained(options.outputDir, reportedOutputPath), sha256: reportedOutputSha256 }],
    })
    ctx.currentProjection.archive = {
      schemaVersion: 1,
      renderRef: { path: layout.archiveRenderPath, sha256: compactRenderFile.sha256 },
      timelineRef: { path: layout.archiveTimelinePath, sha256: archiveTimelineFile.sha256 },
      finalRef: { path: contained(options.outputDir, reportedOutputPath), sha256: reportedOutputSha256 },
      slotCount: compactSlots.length,
    }
    if (!ctx.localCompositionOnly && !options.comicContext) {
      const { activeWork: _activeWork, ...rest } = ctx.currentProjection
      ctx.currentProjection = rest
    }
    const usedSlotReuse = [...recoveredBySlot.values()].some((entry) => entry.value.provenance === 'slot-reuse')
    if (usedSlotReuse && !ctx.localCompositionOnly) {
      ctx.currentProjection = {
        selectedSuccess: ctx.currentProjection.selectedSuccess,
        archive: ctx.currentProjection.archive,
        branchHistory: [],
        readinessAttempts: [],
        renderHistory: [],
        pointerEvents: [{
          sequence: 1,
          action: 'select-success',
          renderIdentity: purePlan.renderIdentity,
          eventSequence: 1,
          resultIdentity: resultFile.value.resultIdentity,
          audioRunId: audioRun.audioRunId,
          actor: LOCAL_ACTOR,
          at: ctx.now(),
        }],
      }
    }
    ctx.terminalState = stateForProjection(options.target, purePlan.targetKey, purePlan.transport, usedSlotReuse && !ctx.localCompositionOnly ? archiveRelativeDir : targetRelativeDir, ctx.currentProjection)
    await publish(ctx, ctx.terminalState)
    return {
      artifactDir: targetRelativeDir,
      operation: purePlan.operation,
      targetKey: purePlan.targetKey,
      transport: purePlan.transport,
      renderIdentity: purePlan.renderIdentity,
      resultIdentity: resultFile.value.resultIdentity,
      audioRunId: audioRun.audioRunId,
      strategy: purePlan.planned.strategy,
      projection: ctx.currentProjection,
    }
  }

  const timelineFile = await writeJsonReplace(options.outputDir, `${options.outputDir}/${layout.archiveTimelinePath}`, timeline)
  const compactSlots = purePlan.planned.slots.map((slot) => {
    const file = batchResultFiles.find((entry) => entry.value.generationSlotId === slot.generationSlotId)
    const output = file?.value.outputs[0]
    if (!output) throw CLIUsageError(`Compact TTS render is missing paid output for ${slot.generationSlotId}.`)
    return {
      slotHash: paidSpeechSlotHash(slot),
      turnIds: [...slot.turnIds],
      sha256: output.sha256,
      durationMs: output.durationMs ?? 0,
      voiceHash: hashCanonicalTtsValue(slot.turnIds.map((turnId) => purePlan.planned.turns.find((turn) => turn.canonical.turnId === turnId)?.voice.valueHash ?? '')),
    }
  })
  const compactRenderBase = {
    schemaVersion: 1 as const,
    targetKey: purePlan.targetKey,
    renderIdentity: purePlan.renderIdentity,
    renderPlanId: purePlan.renderPlanId,
    dialoguePlanId: purePlan.planned.dialoguePlan.dialoguePlanId,
    strategy: purePlan.planned.strategy,
    format: finalAudio.format,
    cost: resultFile.value.cost,
    slots: compactSlots,
    outputs: {
      final: {
        path: contained(options.outputDir, reportedOutputPath),
        sha256: sha256Bytes(finalAudio.bytes),
        durationMs: finalAudio.durationMs,
      },
    },
    retryErrorSummary: {
      requestCount: resultFile.value.observedRequests.length,
      retryCount: resultFile.value.retryAttempts.length,
      failedSlotCount: 0,
    },
  }
  const compactRender = {
    ...compactRenderBase,
    renderId: hashCanonicalTtsValue(compactRenderBase),
  } as unknown as CompactTargetRender
  const compactRenderFile = await writeJsonReplace(options.outputDir, `${options.outputDir}/${layout.archiveRenderPath}`, compactRender)
  const archive: CompactAudioArchive = {
    schemaVersion: 1,
    renderRef: { path: layout.archiveRenderPath, sha256: compactRenderFile.sha256 },
    timelineRef: { path: layout.archiveTimelinePath, sha256: timelineFile.sha256 },
    finalRef: { path: contained(options.outputDir, reportedOutputPath), sha256: reportedOutputSha256 },
    slotCount: compactSlots.length,
  }
  const audioRunBase = {
    schemaVersion: 1 as const,
    targetKey: purePlan.targetKey,
    renderPlanId: purePlan.renderPlanId,
    renderIdentity: purePlan.renderIdentity,
    providerResult: { resultIdentity: resultFile.value.resultIdentity, path: layout.archiveRenderPath, sha256: compactRenderFile.sha256 },
    takeSelections: [],
    continuationCheckpoints: [],
    mixPlan: { mixPlanId: mixPlan.mixPlanId, path: contained(audioRunRoot, mixPlanFile.path), sha256: mixPlanFile.sha256 },
    transformLedger: { transformLedgerId: ledger.transformLedgerId, path: contained(audioRunRoot, ledgerFile.path), sha256: ledgerFile.sha256 },
    finalTimeline: { timelineId: timeline.timelineId, path: layout.archiveTimelinePath, sha256: timelineFile.sha256 },
    finalOutputs: [{ path: contained(options.outputDir, reportedOutputPath), sha256: reportedOutputSha256, format: finalAudio.format, durationMs: finalAudio.durationMs }],
    createdAt: ctx.now(),
  }
  const audioRun = {
    ...audioRunBase,
    audioRunId: hashCanonicalTtsValue(audioRunBase),
  } as AudioRun
  const referencedSlotHashes = new Set(compactSlots.map((slot) => slot.slotHash))
  ctx.currentProjection = {
    selectedSuccess: {
      renderIdentity: purePlan.renderIdentity,
      eventSequence: 1,
      resultIdentity: resultFile.value.resultIdentity,
      audioRunId: audioRun.audioRunId,
    },
    archive,
    branchHistory: [],
    readinessAttempts: [],
    renderHistory: [],
    pointerEvents: [{
      sequence: 1,
      action: 'select-success',
      renderIdentity: purePlan.renderIdentity,
      eventSequence: 1,
      resultIdentity: resultFile.value.resultIdentity,
      audioRunId: audioRun.audioRunId,
      actor: LOCAL_ACTOR,
      at: ctx.now(),
    }],
  }
  ctx.terminalState = stateForProjection(options.target, purePlan.targetKey, purePlan.transport, archiveRelativeDir, ctx.currentProjection)
  await publish(ctx, ctx.terminalState)
  await removeContainedDirectory(options.outputDir, layout.workDir)
  await removeContainedDirectory(options.outputDir, targetRelativeDir)
  await removeContainedDirectory(options.outputDir, ctx.artifactRoot)
  const slotEntries = await readdir(`${options.outputDir}/${layout.slotsDir}`).catch(() => [])
  await Promise.all(slotEntries.map(async (name) => {
    const slotHash = name.replace(/\.wav$/, '')
    if (name.endsWith('.wav') && !referencedSlotHashes.has(slotHash)) {
      await unlink(`${options.outputDir}/${layout.slotsDir}/${name}`).catch(() => undefined)
    }
  }))
  return {
    artifactDir: archiveRelativeDir,
    operation: purePlan.operation,
    targetKey: purePlan.targetKey,
    transport: purePlan.transport,
    renderIdentity: purePlan.renderIdentity,
    resultIdentity: resultFile.value.resultIdentity,
    audioRunId: audioRun.audioRunId,
    strategy: purePlan.planned.strategy,
    projection: ctx.currentProjection,
  }
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
