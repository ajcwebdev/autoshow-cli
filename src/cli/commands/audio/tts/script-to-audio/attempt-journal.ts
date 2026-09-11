import type { AttemptContext, AttemptSlot, ReadinessAuthorization, RenderAdmissionJournalSnapshot, WrittenJson } from '~/types'
import { InternalError } from '~/utils/error-handler'
import {
  appendJsonlArtifactLine,
  reserveInvocationAttemptDirectory,
} from './safe-artifact-store'
import { validateRenderAdmissionJournalSnapshot } from './contract-validation'
import { LOCAL_ACTOR, withIdentity } from './attempt-shared'
import { contained, writeJsonCreateOnly } from './attempt-io'
import { stateForProjection } from './attempt-planning'
import { buildProjection, publish } from './attempt-projection'
import { buildBatchProgress } from './attempt-batches'
import { isArtifactConflictError } from './safe-artifact-store'

export const requireJournalFile = (ctx: AttemptContext): WrittenJson<RenderAdmissionJournalSnapshot> => {
  if (!ctx.journalFile) {
    throw InternalError('TTS admission journal was not started before attempted provider work.', { stage: 'tts:admission' })
  }
  return ctx.journalFile
}

export const journalEventFields = (ctx: AttemptContext): {
  readinessAuthorization: ReadinessAuthorization
  admissionJournalSnapshotId: string
  admissionJournalRef: string
  admissionJournalSha256: string
} => {
  const file = requireJournalFile(ctx)
  return {
    readinessAuthorization: ctx.readinessAuthorization,
    admissionJournalSnapshotId: ctx.journal.snapshotId,
    admissionJournalRef: contained(ctx.targetDir, file.path),
    admissionJournalSha256: file.sha256,
  }
}

const writeJournalLine = async (
  ctx: AttemptContext,
  snapshot: RenderAdmissionJournalSnapshot
): Promise<WrittenJson<RenderAdmissionJournalSnapshot>> => {
  const lastRequest = snapshot.requests.at(-1)
  const lastTransition = lastRequest?.transitions.at(-1)
  await appendJsonlArtifactLine(ctx.options.outputDir, ctx.journalRelativePath, {
    seq: ctx.journalSequence,
    at: snapshot.capturedAt,
    event: lastTransition?.state ?? (snapshot.recordedResult ? 'recorded-result' : snapshot.recordedBatchResults.length > 0 ? 'recorded-batch' : 'prepared'),
    snapshotId: snapshot.snapshotId,
    ...(snapshot.previousSnapshotId ? { previousSnapshotId: snapshot.previousSnapshotId } : {}),
    ...(lastRequest ? { requestOrdinal: lastRequest.requestOrdinal, generationSlotId: lastRequest.generationSlotId } : {}),
    ...(lastRequest ? { slotHash: ctx.paidSpeechSlotHash(ctx.purePlan.planned.slots.find((slot) => slot.generationSlotId === lastRequest.generationSlotId) ?? ctx.purePlan.planned.slots[0] as AttemptSlot) } : {}),
    snapshot,
  })
  return await writeJsonCreateOnly(
    ctx.options.outputDir,
    `${ctx.attemptRoot}/admission-journal-${ctx.journalSequence}.json`,
    snapshot
  )
}

export const ensureJournalStarted = async (ctx: AttemptContext): Promise<void> => {
  if (ctx.journalFile) return
  const reserved = await reserveInvocationAttemptDirectory(ctx.options.outputDir, {
    attemptsDirectory: contained(ctx.options.outputDir, ctx.attemptsRoot),
    attempt: ctx.attemptNumber,
    invocationId: ctx.invocationId,
  })
  if (reserved.relativePath !== contained(ctx.options.outputDir, ctx.attemptRoot)) {
    throw InternalError('Reserved TTS attempt directory does not match its immutable invocation identity.', { stage: 'tts:admission' })
  }
  ctx.attemptReservation = reserved
  try {
    await writeJsonCreateOnly(ctx.options.outputDir, `${ctx.targetDir}/attempt-${String(ctx.attemptNumber).padStart(3, '0')}.json`, {
      schemaVersion: 1,
      attempt: ctx.attemptNumber,
      invocationId: ctx.invocationId,
      journalPath: ctx.journalRelativePath,
    })
  } catch (error) {
    if (!isArtifactConflictError(error)) throw error
  }
  ctx.journalFile = await writeJournalLine(ctx, ctx.journal)
}

const publishJournalState = async (ctx: AttemptContext): Promise<void> => {
  const at = ctx.now()
  requireJournalFile(ctx)
  const retainedProgress = buildBatchProgress(ctx, [...ctx.recoveredBatchFiles, ...ctx.promotedBatchFiles.values()])
  const completedSlotCount = retainedProgress.reduce((sum, batch) =>
    sum + batch.generationSlots.filter((slot) => slot.batchResult?.status === 'succeeded').length
  , 0)
  const previousProgressCount = [...ctx.events].reverse().find((event) => event.batchProgress)?.batchProgress
    ?.reduce((sum, batch) => sum + batch.generationSlots.filter((slot) => slot.batchResult?.status === 'succeeded').length, 0) ?? 0
  const totalSlotCount = ctx.purePlan.planned.slots.length
  const progressInterval = Math.max(1, Math.ceil(totalSlotCount / 10))
  const includeProgress = completedSlotCount > previousProgressCount
    && (completedSlotCount === 1 || completedSlotCount === totalSlotCount || completedSlotCount % progressInterval === 0)
  ctx.events.push({
    sequence: ctx.events.length + 1,
    status: 'running',
    at,
    attempt: ctx.attemptNumber,
    ...journalEventFields(ctx),
    ...(includeProgress ? { batchProgress: retainedProgress } : {}),
  })
  ctx.pointerEvents.push({
    sequence: ctx.pointerEvents.length + 1,
    action: 'activate-render',
    renderIdentity: ctx.purePlan.renderIdentity,
    eventSequence: ctx.events.length,
    actor: LOCAL_ACTOR,
    at,
  })
  ctx.currentProjection = buildProjection(ctx)
  await publish(ctx, stateForProjection(ctx.options.target, ctx.purePlan.targetKey, ctx.purePlan.transport, ctx.targetRelativeDir, ctx.currentProjection))
}

export const writeNextJournal = async (
  ctx: AttemptContext,
  next: RenderAdmissionJournalSnapshot
): Promise<void> => {
  requireJournalFile(ctx)
  const previous = ctx.journal
  const { snapshotId: _discardedSnapshotId, ...base } = next
  const candidate = withIdentity(base as unknown as Record<string, unknown>, 'snapshotId') as unknown as RenderAdmissionJournalSnapshot
  validateRenderAdmissionJournalSnapshot(candidate, previous)
  ctx.journalSequence += 1
  const candidateFile = await writeJournalLine(ctx, candidate)
  ctx.journal = candidate
  ctx.journalFile = candidateFile
  await publishJournalState(ctx)
}

export const advanceJournal = async (
  ctx: AttemptContext,
  requests: RenderAdmissionJournalSnapshot['requests'],
  capturedAt = ctx.now()
): Promise<void> => {
  await writeNextJournal(ctx, {
    ...ctx.journal,
    previousSnapshotId: ctx.journal.snapshotId,
    requests,
    capturedAt,
  })
}
