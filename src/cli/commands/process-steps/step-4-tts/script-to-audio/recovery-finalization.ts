import type {
  AudioMixPlan,
  AudioRun,
  CanonicalAudioProviderProjection,
  PipelineProviderState,
  PlannedCost,
  ProviderBatchResultRef,
  ProviderRenderResult,
  RenderAdmissionJournalSnapshot,
  AggregateProviderResult,
  CurrentTtsCompletedRecovery,
  CurrentTtsReconciliationBlocker,
  LoadedRecoveryBatch,
  PureCurrentTtsRenderPlanOptions,
  RecoveryFinalizationInput,
  RetainedJournalEvidence,
} from '~/types'
import { UsageError, InternalError } from '~/utils/error-handler'
import { concatAndConvertToWav } from '../tts-utils/audio-utils'
import { hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import { validateProviderRenderResult } from './contract-validation'
import {
  contained,
  copyCreateOnly,
  materializeRecoveredBatch,
  publishReportedOutput,
  readObservedAudio,
  readVerifiedJson,
  writeJsonCreateOnly,
} from './attempt-io'
import {
  LOCAL_ACTOR,
  withIdentity,
} from './attempt-shared'
import {
  buildPureCurrentTtsRenderPlan,
  requestedOutput,
  stateForProjection,
} from './attempt-planning'
import { readContainedArtifactFile } from './safe-artifact-store'
import { assembleComicSegmentedAudio } from './comic-segmented-audio'
import {
  buildAudioRun,
  buildFinalTimeline,
  buildFinalTimelineLayout,
  buildSpeechSources,
  buildTransformLedger,
} from './attempt-success-builders'
import {
  resolveRetainedPath,
} from './recovery-evidence'

const findAggregateProviderResult = async (
  options: { rootDir: string },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  journalEvidenceById: Map<string, RetainedJournalEvidence>
): Promise<AggregateProviderResult | undefined> => {
  let aggregate: AggregateProviderResult | undefined
  for (const evidence of [...journalEvidenceById.values()].reverse()) {
    const reference = evidence.value.recordedResult
    if (!reference) continue
    const path = resolveRetainedPath(evidence.attemptRoot, reference.resultRef, 'Stored provider render result')
    const value = await readVerifiedJson<ProviderRenderResult>(
      options.rootDir,
      path,
      reference.resultSha256,
      'Stored provider render result'
    )
    validateProviderRenderResult(value)
    if (
      value.resultIdentity !== reference.resultIdentity
      || value.renderIdentity !== pure.renderIdentity
      || value.renderPlanId !== pure.renderPlanId
    ) throw UsageError('Stored provider render result does not bind the exact planned render.')
    if (value.status !== 'succeeded') continue
    if (aggregate && aggregate.value.resultIdentity !== value.resultIdentity) {
      throw UsageError('Stored TTS render has conflicting successful aggregate provider results; reconciliation is required.')
    }
    aggregate = { value, path, sha256: reference.resultSha256, journalEvidence: evidence }
  }
  return aggregate
}

const buildRecoveredProviderResult = (input: {
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>
  renderRoot: string
  orderedBatches: LoadedRecoveryBatch[]
  retainedCumulativePlannedCost: PlannedCost
}): { compositionId: string, value: ProviderRenderResult } => {
  const batchRefs: ProviderBatchResultRef[] = input.orderedBatches.map((batch) => ({
    batchId: batch.value.batchId,
    generationSlotId: batch.value.generationSlotId,
    batchResultId: batch.value.batchResultId,
    artifactRef: contained(input.renderRoot, batch.path),
    sha256: batch.sha256
  }))
  const observedRequests = input.orderedBatches.flatMap((batch) => batch.value.observedRequests)
  const requestedTurnIds = input.pure.planned.turns.map((turn) => turn.canonical.turnId)
  const turnOutcomes = requestedTurnIds.map((turnId) => {
    const batches = input.orderedBatches.filter((batch) => batch.value.requestedTurnIds.includes(turnId))
    const requests = batches.flatMap((batch) => batch.value.observedRequests.filter((request) =>
      request.turns.some((turn) => turn.turnId === turnId)))
    return {
      turnId,
      status: 'succeeded' as const,
      observedRequests: requests.map((request) => ({ invocationId: request.invocationId, requestOrdinal: request.requestOrdinal })),
      batchIds: [...new Set(batches.map((batch) => batch.value.batchId))],
      generationSlotIds: batches.map((batch) => batch.value.generationSlotId),
      outputIds: batches.flatMap((batch) => batch.value.outputs.map((output) => output.outputId))
    }
  })
  const compositionId = hashCanonicalTtsValue({
    renderPlanId: input.pure.renderPlanId,
    renderIdentity: input.pure.renderIdentity,
    batchResults: batchRefs
  })
  const value = withIdentity({
    schemaVersion: 1 as const,
    closedBy: { kind: 'local-composition' as const, compositionId },
    renderPlanId: input.pure.renderPlanId,
    renderIdentity: input.pure.renderIdentity,
    status: 'succeeded' as const,
    requestedTurnIds,
    batchResults: batchRefs,
    observedRequests,
    outputs: input.orderedBatches.flatMap((batch) => batch.value.outputs.map((output) => ({ ...output, batchResultId: batch.value.batchResultId }))),
    generatedBatches: input.orderedBatches.flatMap((batch) => batch.value.generatedBatch ? [batch.value.generatedBatch] : []),
    turnOutcomes,
    createdResources: input.orderedBatches.flatMap((batch) => batch.value.createdResources),
    retryAttempts: input.orderedBatches.flatMap((batch) => batch.value.retryAttempts),
    cost: {
      currentComposition: { planned: input.pure.plannedRenderCost, observed: [] },
      closingAttempt: { planned: { amounts: [] }, observed: [] },
      cumulativeRenderHistory: { planned: input.retainedCumulativePlannedCost, observed: [] }
    }
  }, 'resultIdentity')
  validateProviderRenderResult(value)
  return { compositionId, value }
}

const buildRecoveryMixPlan = (input: {
  options: PureCurrentTtsRenderPlanOptions
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>
  result: ProviderRenderResult
  journalSnapshotId: string
  createdAt: string
  comicSegmented: boolean
}): AudioMixPlan => {
  const sources = buildSpeechSources(input.result)
  const parametersHash = hashCanonicalTtsValue({
    sourceIds: sources.map((source) => source.sourceId),
    strategy: input.pure.planned.strategy,
    requestedOutput: requestedOutput(input.options),
    recoveryJournalSnapshotId: input.journalSnapshotId,
    dialogueNodes: input.pure.planned.dialoguePlan.nodes
  })
  const base = {
    schemaVersion: 1 as const,
    renderIdentity: input.pure.renderIdentity,
    outputProfileHash: input.pure.outputProfileHash,
    sources,
    operations: [{
      kind: input.comicSegmented
        ? 'dialogue-node-assembly' as const
        : sources.length > 1 ? 'ordered-concat' as const : 'single-source' as const,
      parametersHash
    }],
    createdAt: input.createdAt
  }
  return { ...base, mixPlanId: hashCanonicalTtsValue(base) }
}

const buildRecoveryTiming = (
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  assembledTurns: ReturnType<typeof buildFinalTimelineLayout>['turns']
) => pure.planned.strategy === 'segmented' && assembledTurns.every((turn) => turn.endMs > turn.startMs)
  ? {
      availability: 'timed' as const,
      clock: 'final-audio-ms' as const,
      provenance: 'assembled-segments' as const,
      turns: assembledTurns
    }
  : {
      availability: 'unavailable' as const,
      clock: 'final-audio-ms' as const,
      provenance: 'unavailable' as const,
      turns: pure.planned.turns.map((turn) => ({
        turnId: turn.canonical.turnId,
        subjectKey: turn.canonical.subjectKey
      })),
      reason: 'Recovered provider timing was not exposed at exact turn boundaries.'
    }

const buildRecoveryTerminalEvent = (input: {
  rootDir: string
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>
  retainedRender: CanonicalAudioProviderProjection['renderHistory'][number]
  providerRoot: string
  renderRoot: string
  journal: RenderAdmissionJournalSnapshot
  journalPath: string
  journalSha256: string
  result: ProviderRenderResult
  resultPath: string
  resultSha256: string
  loadedBatches: LoadedRecoveryBatch[]
  finalPath: string
  finalSha256: string
  reportedOutputPath: string
  reportedOutputSha256: string
  audioRun: AudioRun
  audioRunPath: string
  audioRunSha256: string
  readinessAuthorization?: NonNullable<CanonicalAudioProviderProjection['renderHistory'][number]['events'][number]['readinessAuthorization']> | undefined
}) => {
  if (input.result.closedBy.kind === 'provider-attempt' && !input.readinessAuthorization) {
    throw UsageError('Stored completed TTS attempt has no exact readiness authorization.')
  }
  const nextSequence = (input.retainedRender.events.at(-1)?.sequence ?? 0) + 1
  const batchProgress = input.pure.planned.batches.map((batch) => ({
    batchId: batch.batchId,
    generationSlots: batch.generationSlots.map((slot) => {
      const loaded = input.loadedBatches.find((entry) => entry.value.generationSlotId === slot.generationSlotId)
      if (!loaded) throw InternalError('Completed TTS recovery lost one ordered batch.', { stage: 'tts:reconciliation' })
      return {
        generationSlotId: slot.generationSlotId,
        source: 'provider-dispatch' as const,
        batchInvocationPlan: {
          batchInvocationPlanId: loaded.value.batchInvocationPlan.batchInvocationPlanId,
          path: contained(input.renderRoot, resolveRetainedPath(loaded.attemptRoot, loaded.value.batchInvocationPlan.artifactRef, 'Stored batch invocation plan')),
          sha256: loaded.value.batchInvocationPlan.sha256
        },
        batchResult: {
          batchResultId: loaded.value.batchResultId,
          path: contained(input.renderRoot, loaded.path),
          sha256: loaded.sha256,
          status: loaded.value.status
        }
      }
    })
  }))
  return {
    sequence: nextSequence,
    status: 'succeeded' as const,
    at: input.journal.capturedAt,
    attempt: input.journal.attempt,
    ...(input.result.closedBy.kind === 'provider-attempt' ? {
      readinessAuthorization: input.readinessAuthorization,
      admissionJournalSnapshotId: input.journal.snapshotId,
      admissionJournalRef: contained(input.providerRoot, input.journalPath),
      admissionJournalSha256: input.journalSha256
    } : {}),
    providerRenderResultIdentity: input.result.resultIdentity,
    providerRenderResultRef: contained(input.providerRoot, input.resultPath),
    providerRenderResultSha256: input.resultSha256,
    batchProgress,
    outputRefs: [{ path: contained(input.providerRoot, input.finalPath), sha256: input.finalSha256 }],
    reportedOutputRefs: [{ path: contained(input.rootDir, input.reportedOutputPath), sha256: input.reportedOutputSha256 }],
    audioRunId: input.audioRun.audioRunId,
    audioRunRef: contained(input.providerRoot, input.audioRunPath),
    audioRunSha256: input.audioRunSha256
  }
}

const buildRecoveryProjection = (input: {
  resultProjection: CanonicalAudioProviderProjection
  renderIdentity: string
  terminalEvent: ReturnType<typeof buildRecoveryTerminalEvent>
  resultIdentity: string
  audioRunId: string
}): CanonicalAudioProviderProjection => {
  const renderHistory = input.resultProjection.renderHistory.map((entry) =>
    entry.renderIdentity === input.renderIdentity
      ? { ...entry, events: [...entry.events, input.terminalEvent] }
      : entry)
  const pointerStart = input.resultProjection.pointerEvents.reduce(
    (maximum, entry) => Math.max(maximum, entry.sequence),
    0
  ) + 1
  return {
    activeWork: {
      kind: 'render',
      renderIdentity: input.renderIdentity,
      eventSequence: input.terminalEvent.sequence
    },
    selectedSuccess: {
      renderIdentity: input.renderIdentity,
      eventSequence: input.terminalEvent.sequence,
      resultIdentity: input.resultIdentity,
      audioRunId: input.audioRunId
    },
    branchHistory: input.resultProjection.branchHistory,
    readinessAttempts: input.resultProjection.readinessAttempts,
    renderHistory,
    pointerEvents: [
      ...input.resultProjection.pointerEvents,
      {
        sequence: pointerStart,
        action: 'activate-render',
        renderIdentity: input.renderIdentity,
        eventSequence: input.terminalEvent.sequence,
        actor: LOCAL_ACTOR,
        at: input.terminalEvent.at
      },
      {
        sequence: pointerStart + 1,
        action: 'select-success',
        renderIdentity: input.renderIdentity,
        eventSequence: input.terminalEvent.sequence,
        resultIdentity: input.resultIdentity,
        audioRunId: input.audioRunId,
        actor: LOCAL_ACTOR,
        at: input.terminalEvent.at
      }
    ]
  }
}

const orderedRecoveryBatches = (
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  loadedBatches: LoadedRecoveryBatch[]
): LoadedRecoveryBatch[] => pure.planned.slots.map((slot) => {
  const batch = loadedBatches.find((candidate) =>
    candidate.value.generationSlotId === slot.generationSlotId)
  if (!batch) {
    throw InternalError('Completed TTS recovery lost one planned generation slot.', {
      stage: 'tts:reconciliation'
    })
  }
  return batch
})

const assembleRecoveryAudio = async (
  input: RecoveryFinalizationInput,
  orderedBatches: LoadedRecoveryBatch[],
  workspaceDir: string
): Promise<string> => {
  const masteringProfile = input.options.ttsOptions.ttsMasteringProfile
  if (input.options.comicContext && input.pure.planned.strategy === 'segmented') {
    if (!masteringProfile) {
      throw UsageError('Comic segmented recovery requires an explicit mastering profile.')
    }
    return await assembleComicSegmentedAudio({
      dialoguePlan: input.options.comicContext.dialoguePlan,
      turns: input.pure.planned.turns.map((turn) => turn.canonical),
      slots: input.pure.planned.slots,
      outputPathsBySlot: new Map(orderedBatches.map((batch) =>
        [batch.value.generationSlotId, batch.outputPaths] as const)),
      masteringDir: workspaceDir,
      providerLabel: `${input.options.target.service}-recovery`,
      profile: masteringProfile,
    })
  }
  return await concatAndConvertToWav(
    orderedBatches.flatMap((batch) => batch.outputPaths),
    workspaceDir,
    `${input.options.target.service}-recovery`,
    undefined,
    masteringProfile
  )
}

const ensureAggregateProviderResult = async (
  input: RecoveryFinalizationInput,
  orderedBatches: LoadedRecoveryBatch[]
): Promise<AggregateProviderResult> => {
  if (input.aggregate) return input.aggregate
  const promoted = buildRecoveredProviderResult({
    pure: input.pure,
    renderRoot: input.renderRoot,
    orderedBatches,
    retainedCumulativePlannedCost: input.retainedCumulativePlannedCost
  })
  const file = await writeJsonCreateOnly(
    input.options.rootDir,
    `${input.renderRoot}/compositions/${promoted.compositionId}/provider-render-result.json`,
    promoted.value
  )
  return {
    value: promoted.value,
    path: file.path,
    sha256: file.sha256,
    journalEvidence: input.terminalJournalEvidence
  }
}

const publishCompletedRenderRecovery = async (
  input: RecoveryFinalizationInput,
  workspaceDir: string,
  reportedOutputPath: string
) => {
  await Promise.all(input.loadedBatches.map(async (batch) =>
    await materializeRecoveredBatch(input.options.rootDir, batch)))
  const orderedBatches = orderedRecoveryBatches(input.pure, input.loadedBatches)
  const aggregate = await ensureAggregateProviderResult(input, orderedBatches)
  const journal = aggregate.journalEvidence.value
  const assembledPath = await assembleRecoveryAudio(input, orderedBatches, workspaceDir)
  const audioRunRoot = `${input.renderRoot}/results/${aggregate.value.resultIdentity}/recovery-audio-run-${journal.snapshotId.slice(0, 16)}`
  const finalPath = `${audioRunRoot}/final.wav`
  await copyCreateOnly(input.options.rootDir, assembledPath, finalPath)
  const finalAudio = await readObservedAudio(input.options.rootDir, finalPath)
  const finalSha256 = sha256Bytes(finalAudio.bytes)
  const speechSources = buildSpeechSources(aggregate.value)
  const mixPlan = buildRecoveryMixPlan({
    options: input.options,
    pure: input.pure,
    result: aggregate.value,
    journalSnapshotId: journal.snapshotId,
    createdAt: journal.capturedAt,
    comicSegmented: Boolean(input.options.comicContext) && input.pure.planned.strategy === 'segmented'
  })
  const mixPlanFile = await writeJsonCreateOnly(
    input.options.rootDir,
    `${audioRunRoot}/mix-plan.json`,
    mixPlan
  )
  const timelineLayout = buildFinalTimelineLayout({
    turns: input.pure.planned.turns,
    slots: input.pure.planned.slots,
    batchResultFiles: orderedBatches,
    comicDialoguePlan: input.options.comicContext?.dialoguePlan,
  })
  const ledger = buildTransformLedger({
    renderIdentity: input.pure.renderIdentity,
    requestedOutput: requestedOutput(input.options),
    sources: speechSources,
    finalDurationMs: finalAudio.durationMs,
    turns: input.pure.planned.turns,
    timelineLayout
  })
  const ledgerFile = await writeJsonCreateOnly(
    input.options.rootDir,
    `${audioRunRoot}/transform-ledger.json`,
    ledger
  )
  const timeline = buildFinalTimeline({
    renderIdentity: input.pure.renderIdentity,
    timing: buildRecoveryTiming(input.pure, timelineLayout.turns),
    speechSources,
    transformLedgerRef: {
      path: contained(audioRunRoot, ledgerFile.path),
      sha256: ledgerFile.sha256
    }
  })
  const timelineFile = await writeJsonCreateOnly(
    input.options.rootDir,
    `${audioRunRoot}/final-timeline.json`,
    timeline
  )
  const audioRun = buildAudioRun({
    schemaVersion: 1,
    targetKey: input.pure.targetKey,
    renderPlanId: input.pure.renderPlanId,
    renderIdentity: input.pure.renderIdentity,
    providerResult: {
      resultIdentity: aggregate.value.resultIdentity,
      path: contained(input.renderRoot, aggregate.path),
      sha256: aggregate.sha256
    },
    takeSelections: [],
    continuationCheckpoints: [],
    mixPlan: {
      mixPlanId: mixPlan.mixPlanId,
      path: contained(audioRunRoot, mixPlanFile.path),
      sha256: mixPlanFile.sha256
    },
    transformLedger: {
      transformLedgerId: ledger.transformLedgerId,
      path: contained(audioRunRoot, ledgerFile.path),
      sha256: ledgerFile.sha256
    },
    finalTimeline: {
      timelineId: timeline.timelineId,
      path: contained(audioRunRoot, timelineFile.path),
      sha256: timelineFile.sha256
    },
    finalOutputs: [{
      path: contained(audioRunRoot, finalPath),
      sha256: finalSha256,
      format: finalAudio.format,
      durationMs: finalAudio.durationMs
    }],
    createdAt: journal.capturedAt
  })
  const audioRunFile = await writeJsonCreateOnly(
    input.options.rootDir,
    `${audioRunRoot}/audio-run.json`,
    audioRun
  )
  await publishReportedOutput(
    input.options.rootDir,
    assembledPath,
    reportedOutputPath,
    input.resultProjection
  )
  const reportedOutputSha256 = sha256Bytes((await readContainedArtifactFile(
    input.options.rootDir,
    contained(input.options.rootDir, reportedOutputPath)
  )).bytes)
  const readinessAuthorization = [...input.retainedRender.events].reverse().find((event) =>
    event.attempt === journal.attempt && event.readinessAuthorization)?.readinessAuthorization
  const terminalEvent = buildRecoveryTerminalEvent({
    rootDir: input.options.rootDir,
    pure: input.pure,
    retainedRender: input.retainedRender,
    providerRoot: input.providerRoot,
    renderRoot: input.renderRoot,
    journal,
    journalPath: aggregate.journalEvidence.path,
    journalSha256: aggregate.journalEvidence.sha256,
    result: aggregate.value,
    resultPath: aggregate.path,
    resultSha256: aggregate.sha256,
    loadedBatches: orderedBatches,
    finalPath,
    finalSha256,
    reportedOutputPath,
    reportedOutputSha256,
    audioRun,
    audioRunPath: audioRunFile.path,
    audioRunSha256: audioRunFile.sha256,
    readinessAuthorization
  })
  const projection = buildRecoveryProjection({
    resultProjection: input.resultProjection,
    renderIdentity: input.pure.renderIdentity,
    terminalEvent,
    resultIdentity: aggregate.value.resultIdentity,
    audioRunId: audioRun.audioRunId
  })
  const state = stateForProjection(
    input.options.target,
    input.pure.targetKey,
    input.pure.transport,
    input.options.state.artifactDir,
    projection
  )
  await input.options.onProviderState?.(state)
  return {
    artifactDir: input.options.state.artifactDir,
    operation: input.pure.operation,
    targetKey: input.pure.targetKey,
    transport: input.pure.transport,
    renderIdentity: input.pure.renderIdentity,
    resultIdentity: aggregate.value.resultIdentity,
    audioRunId: audioRun.audioRunId,
    strategy: input.pure.planned.strategy,
    projection
  }
}

export const assembleCompletedRenderRecovery = async (
  options: PureCurrentTtsRenderPlanOptions & {
    rootDir: string
    state: PipelineProviderState
    onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
    reconciliationMode?: 'enforce' | 'report' | undefined
  },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  resultProjection: CanonicalAudioProviderProjection,
  retainedRender: CanonicalAudioProviderProjection['renderHistory'][number],
  renderRoot: string,
  providerRoot: string,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  terminalJournalEvidence: RetainedJournalEvidence,
  loadedBatches: LoadedRecoveryBatch[],
  retainedCumulativePlannedCost: PlannedCost,
  reconciliationBlockers: CurrentTtsReconciliationBlocker[]
): Promise<CurrentTtsCompletedRecovery> => {
  const aggregate = await findAggregateProviderResult(options, pure, journalEvidenceById)
  const effectiveTerminalJournal = aggregate?.journalEvidence ?? terminalJournalEvidence
  const input: RecoveryFinalizationInput = {
    options,
    pure,
    resultProjection,
    retainedRender,
    renderRoot,
    providerRoot,
    terminalJournalEvidence: effectiveTerminalJournal,
    loadedBatches,
    retainedCumulativePlannedCost,
    reconciliationBlockers,
    aggregate
  }
  return {
    kind: 'complete-render',
    preparedState: options.state,
    chunkCount: pure.planned.slots.length,
    reconciliationBlockers,
    finalize: async (workspaceDir, reportedOutputPath) =>
      await publishCompletedRenderRecovery(input, workspaceDir, reportedOutputPath)
  }
}
