import type {
  AudioMixPlan,
  AudioRun,
  CanonicalAudioProviderProjection,
  LoadedRecoveryBatch,
  PlannedCost,
  ProviderBatchResultRef,
  ProviderRenderResult,
  PureCurrentTtsRenderPlanOptions,
  RenderAdmissionJournalSnapshot
} from '~/types'
import { InternalError, UsageError } from '~/utils/error-handler'
import {
  contained
} from './attempt-io'
import {
  buildPureCurrentTtsRenderPlan,
  requestedOutput
} from './attempt-planning'
import {
  LOCAL_ACTOR,
  withIdentity,
} from './attempt-shared'
import {
  buildFinalTimelineLayout,
  buildSpeechSources
} from './attempt-success-builders'
import { hashCanonicalTtsValue } from './contract-identity'
import { validateProviderRenderResult } from './contract-validation'
import {
  resolveRetainedPath,
} from './recovery-evidence'

export const buildRecoveredProviderResult = (input: {
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

export const buildRecoveryMixPlan = (input: {
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

export const buildRecoveryTiming = (
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

export const buildRecoveryTerminalEvent = (input: {
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

export const buildRecoveryProjection = (input: {
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
