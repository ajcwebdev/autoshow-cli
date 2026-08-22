import type { CurrentTtsReconciliationBlocker, LoadedRecoveryBatch, PlannedCost, RetainedJournalEvidence } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { buildPureCurrentTtsRenderPlan, sumCosts } from './attempt-planning'

const collectCostedDispatches = (
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  journalEvidenceById: Map<string, RetainedJournalEvidence>
): {
  completedSlotIds: Set<string>
  retainedAttemptCosts: PlannedCost[]
  costedDispatches: Set<string>
} => {
  const plannedSlotIds = pure.planned.slots.map((slot) => slot.generationSlotId)
  const completedSlotIds = new Set<string>()
  const retainedAttemptCosts: PlannedCost[] = []
  const costedDispatches = new Set<string>()
  for (const evidence of journalEvidenceById.values()) {
    for (const request of evidence.value.requests) {
      if (!plannedSlotIds.includes(request.generationSlotId)) {
        throw CLIUsageError('Stored TTS admission journal contains a request outside the immutable generation-slot plan.')
      }
      const terminal = request.transitions.at(-1)?.state
      if (terminal === 'completed') completedSlotIds.add(request.generationSlotId)
      if (request.retryOfRequestOrdinal === undefined && request.transitions.some((transition) => transition.state === 'dispatch-started')) {
        const key = `${evidence.value.invocationId}\0${request.generationSlotId}`
        if (costedDispatches.has(key)) continue
        const slot = pure.planned.slots.find((entry) => entry.generationSlotId === request.generationSlotId)
        if (!slot) throw CLIUsageError('Stored TTS dispatch has no matching immutable planned slot cost.')
        costedDispatches.add(key)
        retainedAttemptCosts.push(slot.plannedCost)
      }
    }
  }
  return { completedSlotIds, retainedAttemptCosts, costedDispatches }
}
const collectReconciliationBlockers = (
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  loadedBatches: LoadedRecoveryBatch[]
): CurrentTtsReconciliationBlocker[] => {
  const blockers: CurrentTtsReconciliationBlocker[] = []
  for (const slot of pure.planned.slots) {
    const requests = [...journalEvidenceById.values()].flatMap((evidence) => evidence.value.requests
      .filter((request) => request.generationSlotId === slot.generationSlotId)
      .map((request) => ({ evidence, request })))
    const completedRequestCount = requests.filter(({ request }) => request.transitions.at(-1)?.state === 'completed').length
    if (completedRequestCount > 1) {
      throw CLIUsageError(`Stored TTS generation slot ${slot.generationSlotId} has more than one completed deliberate request.`)
    }
    const hasRecoveredSuccess = loadedBatches.some((batch) => batch.value.generationSlotId === slot.generationSlotId)
    if (hasRecoveredSuccess) continue
    for (const { evidence, request } of requests) {
      const state = request.transitions.at(-1)?.state
      if (
        state === undefined
        || state === 'completed'
        || state === 'prepared'
        || state === 'provider-rejected'
        || state === 'confirmed-not-admitted'
      ) continue
      blockers.push({
        generationSlotId: slot.generationSlotId,
        state,
        attempt: evidence.value.attempt,
        invocationId: evidence.value.invocationId,
        requestOrdinal: request.requestOrdinal
      })
    }
  }
  return blockers
}

const enforceReconciliationBlocker = (
  blockers: CurrentTtsReconciliationBlocker[],
  options: {
    ttsOptions: { ttsAllowAmbiguousRedispatch?: boolean }
    reconciliationMode?: 'enforce' | 'report' | undefined
  }
): void => {
  const blocker = blockers[0]
  if (!blocker || options.reconciliationMode === 'report' || options.ttsOptions.ttsAllowAmbiguousRedispatch === true) return
  throw CLIUsageError(`Stored TTS generation slot ${blocker.generationSlotId} has ${blocker.state} provider work in attempt ${blocker.attempt}, request ${blocker.requestOrdinal}; automatic redispatch is blocked pending reconciliation. Pass --allow-ambiguous-redispatch to safely reconcile the pending slot, reuse all completed segment audio, and resume synthesis without deleting output directories or losing work.`)
}

export const reconcileSlotCosts = (
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  loadedBatches: LoadedRecoveryBatch[],
  options: {
    ttsOptions: { ttsAllowAmbiguousRedispatch?: boolean }
    reconciliationMode?: 'enforce' | 'report' | undefined
  }
): {
  completedSlotIds: Set<string>
  retainedCumulativePlannedCost: PlannedCost
  reconciliationBlockers: CurrentTtsReconciliationBlocker[]
} => {
  const { completedSlotIds, retainedAttemptCosts, costedDispatches } = collectCostedDispatches(
    pure,
    journalEvidenceById
  )
  const reconciliationBlockers = collectReconciliationBlockers(pure, journalEvidenceById, loadedBatches)
  enforceReconciliationBlocker(reconciliationBlockers, options)
  for (const batch of loadedBatches) {
    if (!completedSlotIds.has(batch.value.generationSlotId)) {
      throw CLIUsageError('Stored successful provider batch result is not backed by one completed slot request.')
    }
    const key = `${batch.value.invocationId}\0${batch.value.generationSlotId}`
    if (!costedDispatches.has(key)) {
      costedDispatches.add(key)
      retainedAttemptCosts.push(batch.value.cost.planned)
    }
  }
  for (const slotId of completedSlotIds) {
    if (loadedBatches.filter((batch) => batch.value.generationSlotId === slotId).length !== 1) {
      if (options.ttsOptions.ttsAllowAmbiguousRedispatch === true) continue
      throw CLIUsageError(`Stored completed TTS generation slot ${slotId} has no exact promoted batch result.`)
    }
  }
  return {
    completedSlotIds,
    retainedCumulativePlannedCost: sumCosts(retainedAttemptCosts),
    reconciliationBlockers
  }
}
