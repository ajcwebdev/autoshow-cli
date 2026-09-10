import type {
  AttemptContext,
  AudioRun,
  CanonicalAudioProviderProjection,
  PipelineProviderState,
  ProviderBatchResult,
  ProviderRenderResult,
  SanitizedProviderError,
  WrittenJson,
} from '~/types'
import { LOCAL_ACTOR } from './attempt-shared'
import { contained } from './attempt-io'
import { requireJournalFile, journalEventFields } from './attempt-journal'
import { buildBatchProgress } from './attempt-batches'

export const locked = async <T>(ctx: AttemptContext, work: () => Promise<T>): Promise<T> => {
  const prior = ctx.mutation
  let release = () => {}
  ctx.mutation = new Promise<void>((resolve) => { release = resolve })
  await prior
  try { return await work() } finally { release() }
}

export const publish = async (ctx: AttemptContext, state: PipelineProviderState): Promise<void> => {
  await ctx.options.onProviderState?.(state)
}

export const completedSlotHashesForProjection = (ctx: AttemptContext): string[] =>
  ctx.purePlan.planned.slots.flatMap((slot) => {
    const generationSlotId = slot.generationSlotId
    const promoted = ctx.promotedBatchFiles.get(generationSlotId)
    const completed = ctx.recoveredBySlot.has(generationSlotId)
      || (ctx.outputsBySlot.get(generationSlotId)?.length ?? 0) > 0
      || promoted?.value.status === 'succeeded'
    return completed ? [ctx.paidSpeechSlotHash(slot)] : []
  })

export const buildProjection = (
  ctx: AttemptContext,
  terminal?: {
    result?: WrittenJson<ProviderRenderResult> | undefined
    audioRun?: WrittenJson<AudioRun> | undefined
  }
): CanonicalAudioProviderProjection => {
  const completedSlotHashes = completedSlotHashesForProjection(ctx)
  return {
    activeWork: {
      kind: 'render',
      renderIdentity: ctx.purePlan.renderIdentity,
      eventSequence: ctx.events.length,
      ...(ctx.journalFile ? { journalPath: ctx.journalRelativePath } : {}),
      ...(completedSlotHashes.length > 0 ? { completedSlotHashes } : {})
    },
    ...(terminal?.result && terminal.audioRun ? {
      selectedSuccess: {
        renderIdentity: ctx.purePlan.renderIdentity,
        eventSequence: ctx.events.length,
        resultIdentity: terminal.result.value.resultIdentity,
        audioRunId: terminal.audioRun.value.audioRunId,
      }
    } : {}),
    branchHistory: [{
      sequence: 1,
      branchPlanId: ctx.purePlan.branchPlan.branchPlanId,
      branchPlanRef: contained(ctx.targetDir, ctx.branchFile.path),
      branchPlanSha256: ctx.branchFile.sha256,
      createdAt: ctx.journal.capturedAt,
    }],
    readinessAttempts: [{
      sequence: 1,
      branchPlanId: ctx.purePlan.branchPlan.branchPlanId,
      readinessResultRef: contained(ctx.targetDir, ctx.readinessFile.path),
      readinessResultHash: ctx.readinessFile.sha256,
      accountObservationHashes: [ctx.capabilityObservation.observationHash],
      at: ctx.readinessResult.checkedAt,
      status: 'ready',
      admissionDisposition: 'eligible',
    }],
    renderHistory: [{
      renderIdentity: ctx.purePlan.renderIdentity,
      renderPlanId: ctx.purePlan.renderPlanId,
      renderPlanRef: contained(ctx.targetDir, ctx.renderPlanFile.path),
      renderPlanSha256: ctx.renderPlanFile.sha256,
      voiceContextKey: ctx.purePlan.voiceContextKey,
      synthesisSettingsHash: ctx.purePlan.synthesisSettingsHash,
      outputProfileHash: ctx.purePlan.outputProfileHash,
      renderDir: contained(ctx.targetDir, ctx.renderRoot),
      events: ctx.events.map((event) => ({ ...event })),
    }],
    pointerEvents: ctx.pointerEvents.map((event) => ({ ...event }))
  }
}

export const appendTerminalProjection = (
  ctx: AttemptContext,
  status: 'succeeded' | 'failed',
  terminal: {
    result?: WrittenJson<ProviderRenderResult> | undefined
    audioRun?: WrittenJson<AudioRun> | undefined
    outputRefs?: Array<{ path: string, sha256: string }> | undefined
    reportedOutputRefs?: Array<{ path: string, sha256: string }> | undefined
    error?: SanitizedProviderError | undefined
    batchResultFiles?: Array<WrittenJson<ProviderBatchResult>> | undefined
  }
): CanonicalAudioProviderProjection => {
  const at = ctx.now()
  if (!ctx.localCompositionOnly) requireJournalFile(ctx)
  ctx.events.push({
    sequence: ctx.events.length + 1,
    status,
    at,
    attempt: ctx.localCompositionOnly ? ctx.priorAttemptCount : ctx.attemptNumber,
    ...(ctx.localCompositionOnly ? {} : journalEventFields(ctx)),
    ...(terminal.result ? {
      providerRenderResultIdentity: terminal.result.value.resultIdentity,
      providerRenderResultRef: contained(ctx.targetDir, terminal.result.path),
      providerRenderResultSha256: terminal.result.sha256,
    } : {}),
    ...(terminal.outputRefs ? { outputRefs: terminal.outputRefs } : {}),
    ...(terminal.reportedOutputRefs ? { reportedOutputRefs: terminal.reportedOutputRefs } : {}),
    ...(terminal.audioRun ? {
      audioRunId: terminal.audioRun.value.audioRunId,
      audioRunRef: contained(ctx.targetDir, terminal.audioRun.path),
      audioRunSha256: terminal.audioRun.sha256,
    } : {}),
    ...(terminal.batchResultFiles?.length ? { batchProgress: buildBatchProgress(ctx, terminal.batchResultFiles) } : {}),
    ...(terminal.error ? { error: terminal.error } : {}),
  })
  ctx.pointerEvents.push({
    sequence: ctx.pointerEvents.length + 1,
    action: 'activate-render',
    renderIdentity: ctx.purePlan.renderIdentity,
    eventSequence: ctx.events.length,
    actor: LOCAL_ACTOR,
    at,
  })
  if (status === 'succeeded' && terminal.result && terminal.audioRun) {
    ctx.pointerEvents.push({
      sequence: ctx.pointerEvents.length + 1,
      action: 'select-success',
      renderIdentity: ctx.purePlan.renderIdentity,
      eventSequence: ctx.events.length,
      resultIdentity: terminal.result.value.resultIdentity,
      audioRunId: terminal.audioRun.value.audioRunId,
      actor: LOCAL_ACTOR,
      at,
    })
  }
  return buildProjection(ctx, terminal)
}
