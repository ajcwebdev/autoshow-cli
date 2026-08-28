import type {
  AttemptContext,
  AttemptSlot,
  AttemptTurn,
  CanonicalBatchProgress,
  ProviderBatchOutput,
  ProviderBatchResult,
  SanitizedProviderError,
  WrittenJson,
} from '~/types'
import { UsageError, InternalError } from '~/utils/error-handler'
import { canonicalTtsJson, hashCanonicalTtsValue } from './contract-identity'
import { validateProviderBatchResult } from './contract-validation'
import { withIdentity } from './attempt-shared'
import { contained, writeJson } from './attempt-io'
import { resolveRetainedPath } from './recovery-evidence'
import { requireJournalFile, writeNextJournal } from './attempt-journal'

export const buildBatchProgress = (
  ctx: AttemptContext,
  resultFiles: readonly WrittenJson<ProviderBatchResult>[]
): CanonicalBatchProgress[] => {
  const { purePlan, runtimeRequests, recoveredBySlot, renderRoot, layout } = ctx
  return purePlan.planned.batches.map((batch) => ({
    batchId: batch.batchId,
    generationSlots: batch.generationSlots.flatMap<CanonicalBatchProgress['generationSlots'][number]>((slot) => {
      const request = runtimeRequests.find((entry) => entry.slot.generationSlotId === slot.generationSlotId)
      const recovered = recoveredBySlot.get(slot.generationSlotId)
      const result = resultFiles.find((file) => file.value.generationSlotId === slot.generationSlotId)
      const invocationPlan = request
        ? {
            batchInvocationPlanId: request.invocationFile.value.batchInvocationPlanId,
            path: contained(renderRoot, request.invocationFile.path),
            sha256: request.invocationFile.sha256,
          }
        : recovered?.value.provenance === 'provider-dispatch' && recovered.attemptRoot
          ? {
              batchInvocationPlanId: recovered.value.batchInvocationPlan.batchInvocationPlanId,
              path: contained(renderRoot, resolveRetainedPath(recovered.attemptRoot, recovered.value.batchInvocationPlan.artifactRef, 'Recovered batch invocation plan')),
              sha256: recovered.value.batchInvocationPlan.sha256,
            }
          : undefined
      if (recovered?.value.provenance === 'slot-reuse' && result) {
        return [{
          generationSlotId: slot.generationSlotId,
          source: 'slot-reuse' as const,
          slotHash: recovered.value.slotHash,
          batchResult: {
            batchResultId: result.value.batchResultId,
            path: layout.slotResultPath(recovered.value.slotHash),
            sha256: result.sha256,
            status: 'succeeded' as const,
          },
        }]
      }
      return invocationPlan ? [{
        generationSlotId: slot.generationSlotId,
        source: 'provider-dispatch' as const,
        batchInvocationPlan: invocationPlan,
        ...(result ? {
          batchResult: {
            batchResultId: result.value.batchResultId,
            path: contained(renderRoot, result.path),
            sha256: result.sha256,
            status: result.value.status,
          },
        } : {}),
      }] : []
    }),
  })).filter((batch) => batch.generationSlots.length > 0)
}

export const promoteBatchResult = async (
  ctx: AttemptContext,
  slot: AttemptSlot,
  closingError?: SanitizedProviderError | undefined
): Promise<WrittenJson<ProviderBatchResult>> => {
  const existing = ctx.promotedBatchFiles.get(slot.generationSlotId)
  if (existing) return existing
  const requests = ctx.runtimeRequests.filter((entry) => entry.slot.generationSlotId === slot.generationSlotId)
  if (requests.length === 0) {
    throw InternalError('A provider batch result cannot be promoted before serializer dispatch.', { stage: 'tts:admission' })
  }
  const recordedOutputs = ctx.outputsBySlot.get(slot.generationSlotId) ?? []
  const providerCompleted = requests.some((entry) => entry.terminal === 'completed')
  const succeeded = providerCompleted && recordedOutputs.length > 0
  const ambiguous = !succeeded && requests.some((entry) => entry.terminal === 'ambiguous' || entry.terminal === undefined)
  const status = succeeded ? 'succeeded' as const : ambiguous ? 'ambiguous' as const : 'failed' as const
  const outputs: ProviderBatchOutput[] = recordedOutputs.map((output, outputIndex) => ({
    outputId: `output-${hashCanonicalTtsValue({ generationSlotId: slot.generationSlotId, outputIndex, sha256: output.sha256, format: output.format }).slice(0, 24)}`,
    artifactRef: output.relativeToBatchResult,
    sha256: output.sha256,
    format: output.format,
    durationMs: output.durationMs,
  }))
  const localError = status === 'succeeded' ? undefined : closingError ?? {
    phase: 'synthesis' as const,
    code: status === 'ambiguous' ? 'provider_outcome_ambiguous' : 'provider_request_failed',
    message: status === 'ambiguous' ? 'Provider admission outcome is ambiguous.' : 'Provider request failed.',
    retryable: status === 'ambiguous',
  }
  const admissionBasis = requireJournalFile(ctx)
  const admissionSnapshotId = ctx.journal.snapshotId
  const firstRequest = requests[0]
  if (!firstRequest) {
    throw InternalError('A provider batch result is missing its immutable invocation plan.', { stage: 'tts:admission' })
  }
  const resultBase = {
    schemaVersion: 1 as const,
    renderPlanId: ctx.purePlan.renderPlanId,
    renderIdentity: ctx.purePlan.renderIdentity,
    batchId: slot.batchId,
    generationSlotId: slot.generationSlotId,
    status,
    requestedTurnIds: slot.turnIds,
    outputs: succeeded ? outputs : [],
    ...(succeeded ? {
      generatedBatch: {
        batchId: slot.batchId,
        generationSlotId: slot.generationSlotId,
        takes: outputs.map((output, outputIndex) => ({
          ...(() => {
            const recorded = recordedOutputs[outputIndex]
            return recorded?.providerGenerationId
              ? { providerGenerationId: recorded.providerGenerationId, continuationCandidate: { kind: 'provider-generation-id' as const, value: recorded.providerGenerationId } }
              : {}
          })(),
          takeId: `take-${hashCanonicalTtsValue({ generationSlotId: slot.generationSlotId, outputId: output.outputId, sha256: output.sha256 }).slice(0, 24)}`,
          generationSlotId: slot.generationSlotId,
          audio: { artifactRef: output.artifactRef, outputId: output.outputId, sha256: output.sha256, format: output.format },
          durationMs: output.durationMs ?? 0,
          timing: recordedOutputs[outputIndex]?.timing ?? {
            availability: 'unavailable' as const,
            clock: 'take-audio-ms' as const,
            provenance: 'unavailable' as const,
            turns: slot.turnIds.map((turnId) => ({
              turnId,
              subjectKey: (ctx.purePlan.planned.turns.find((turn) => turn.canonical.turnId === turnId) as AttemptTurn).canonical.subjectKey,
            })),
            reason: 'Provider timing was not exposed by the adapter.',
          },
          warnings: [...(recordedOutputs[outputIndex]?.warnings ?? [])],
        })),
        batchCost: { planned: slot.plannedCost, observed: [] },
        costEvidence: [],
        generatedAt: ctx.now(),
        source: 'provider-dispatch' as const,
        batchInvocationPlanId: firstRequest.invocationFile.value.batchInvocationPlanId,
        observedRequestOrdinals: requests.map((entry) => entry.request.requestOrdinal),
      },
    } : {}),
    turnOutcomes: slot.turnIds.map((turnId) => ({
      turnId,
      status,
      outputIds: succeeded ? outputs.map((output) => output.outputId) : [],
      ...(localError ? { error: localError } : {}),
    })),
    createdResources: [],
    cost: { planned: slot.plannedCost, observed: [] },
    ...(localError ? { error: localError } : {}),
    provenance: 'provider-dispatch' as const,
    invocationId: ctx.invocationId,
    attempt: ctx.attemptNumber,
    batchInvocationPlan: {
      batchInvocationPlanId: firstRequest.invocationFile.value.batchInvocationPlanId,
      artifactRef: contained(ctx.attemptRoot, firstRequest.invocationFile.path),
      sha256: firstRequest.invocationFile.sha256,
    },
    admissionBasis: {
      journalId: ctx.journalId,
      snapshotId: admissionSnapshotId,
      artifactRef: contained(ctx.attemptRoot, admissionBasis.path),
      sha256: admissionBasis.sha256,
    },
    observedRequests: requests.map((entry) => entry.request),
    retryAttempts: requests.flatMap((entry) => entry.retry ? [entry.retry] : []),
  }
  const result = withIdentity(resultBase, 'batchResultId') as unknown as ProviderBatchResult
  validateProviderBatchResult(result)
  const file = await writeJson(
    ctx.options.outputDir,
    `${ctx.attemptRoot}/batch-results/${slot.batchId}/${slot.generationSlotId}/provider-batch-result.json`,
    result
  )
  ctx.promotedBatchFiles.set(slot.generationSlotId, file)
  const reference = {
    batchId: file.value.batchId,
    generationSlotId: file.value.generationSlotId,
    batchResultId: file.value.batchResultId,
    batchResultRef: contained(ctx.attemptRoot, file.path),
    batchResultSha256: file.sha256,
    admissionBasisSnapshotId: admissionSnapshotId,
  }
  const existingReference = ctx.journal.recordedBatchResults.find((entry) => entry.generationSlotId === slot.generationSlotId)
  if (existingReference) {
    if (canonicalTtsJson(existingReference) !== canonicalTtsJson(reference)) {
      throw UsageError('TTS admission journal contains conflicting batch-result evidence for one generation slot.')
    }
    return file
  }
  await writeNextJournal(ctx, {
    ...ctx.journal,
    previousSnapshotId: ctx.journal.snapshotId,
    recordedBatchResults: [...ctx.journal.recordedBatchResults, reference],
    capturedAt: ctx.now(),
  })
  return file
}
