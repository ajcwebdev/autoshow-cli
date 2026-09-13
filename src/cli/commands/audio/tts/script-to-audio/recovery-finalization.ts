import type {
  AggregateProviderResult,
  CanonicalAudioProviderProjection,
  CurrentTtsCompletedRecovery,
  CurrentTtsReconciliationBlocker,
  LoadedRecoveryBatch,
  PipelineProviderState,
  PlannedCost,
  ProviderRenderResult,
  PureCurrentTtsRenderPlanOptions,
  RecoveryFinalizationInput,
  RetainedJournalEvidence
} from '~/types'
import { InternalError, UsageError } from '~/utils/error-handler'
import { concatAndConvertToWav } from '../tts-utils/audio-utils'
import {
  contained,
  copyCreateOnly,
  createAudioRunArtifactWriter,
  materializeRecoveredBatch,
  publishReportedOutput,
  readObservedAudio,
  readVerifiedJson,
  writeJsonCreateOnly,
} from './attempt-io'
import {
  buildPureCurrentTtsRenderPlan,
  requestedOutput,
  stateForProjection,
} from './attempt-planning'
import {
  buildAudioRun,
  buildFinalTimeline,
  buildFinalTimelineLayout,
  buildSpeechSources,
  buildTransformLedger,
} from './attempt-success-builders'
import { assembleComicSegmentedAudio } from './comic-segmented-audio'
import { sha256Bytes } from './contract-identity'
import { validateProviderRenderResult } from './contract-validation'
import {
  resolveRetainedPath,
} from './recovery-evidence'
import { buildRecoveredProviderResult, buildRecoveryMixPlan, buildRecoveryProjection, buildRecoveryTerminalEvent, buildRecoveryTiming } from './recovery-record-builders'
import { readContainedArtifactFile } from './safe-artifact-store'

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
): Promise<{
  path: string
  turnDurationMs?: ReadonlyMap<string, number> | undefined
  timingSegmentDurationMs?: ReadonlyMap<string, number> | undefined
}> => {
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
  return {
    path: await concatAndConvertToWav(
      orderedBatches.flatMap((batch) => batch.outputPaths),
      workspaceDir,
      `${input.options.target.service}-recovery`,
      undefined,
      masteringProfile
    )
  }
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
  const assembled = await assembleRecoveryAudio(input, orderedBatches, workspaceDir)
  const assembledPath = assembled.path
  const audioRunRoot = `${input.renderRoot}/results/${aggregate.value.resultIdentity}/recovery-audio-run-${journal.snapshotId.slice(0, 16)}`
  const writer = createAudioRunArtifactWriter(input.options.rootDir, audioRunRoot)
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
  const mixPlanFile = await writer.write('mix-plan.json', mixPlan)
  const timelineLayout = buildFinalTimelineLayout({
    turns: input.pure.planned.turns,
    slots: input.pure.planned.slots,
    batchResultFiles: orderedBatches,
    comicDialoguePlan: input.options.comicContext?.dialoguePlan,
    masteredTurnDurationMs: assembled.turnDurationMs,
    masteredTimingSegmentDurationMs: assembled.timingSegmentDurationMs,
  })
  const ledger = buildTransformLedger({
    renderIdentity: input.pure.renderIdentity,
    requestedOutput: requestedOutput(input.options),
    sources: speechSources,
    finalDurationMs: finalAudio.durationMs,
    turns: input.pure.planned.turns,
    timelineLayout
  })
  const ledgerFile = await writer.write('transform-ledger.json', ledger)
  const timeline = buildFinalTimeline({
    renderIdentity: input.pure.renderIdentity,
    timing: buildRecoveryTiming(input.pure, timelineLayout.turns),
    speechSources,
    transformLedgerRef: ledgerFile.ref
  })
  const timelineFile = await writer.write('final-timeline.json', timeline)
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
      ...mixPlanFile.ref
    },
    transformLedger: {
      transformLedgerId: ledger.transformLedgerId,
      ...ledgerFile.ref
    },
    finalTimeline: {
      timelineId: timeline.timelineId,
      ...timelineFile.ref
    },
    finalOutputs: [{
      path: contained(audioRunRoot, finalPath),
      sha256: finalSha256,
      format: finalAudio.format,
      durationMs: finalAudio.durationMs
    }],
    createdAt: journal.capturedAt
  })
  const audioRunFile = await writer.write('audio-run.json', audioRun)
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
