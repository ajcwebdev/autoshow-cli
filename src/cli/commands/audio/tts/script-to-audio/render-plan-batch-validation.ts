import type { ProviderRenderPlan } from '~/types'
import type { ProviderResolvedDialogueTurn } from '~/types/tts-workflow/voice-and-dialogue-types'
import { UsageError } from '~/utils/error-handler'
import { assertExactStringSet, assertUnique, validatePlannedCost, validateTypedSettings } from './contract-validation-primitives'

export const validateRenderPlanBatches = (plan: ProviderRenderPlan, turns: ProviderResolvedDialogueTurn[]): void => {
  const batchIds = plan.batches.map((batch) => batch.batchId)
  assertUnique(batchIds, 'Provider render batch IDs')
  const slotIds = plan.batches.flatMap((batch) => batch.generationSlots.map((slot) => slot.generationSlotId))
  assertUnique(slotIds, 'Provider render generation slot IDs')
  const orderedTurnIds = plan.batches.flatMap((batch) => batch.orderedTurnIds)
  if (plan.strategy !== 'hybrid') {
    assertExactStringSet(orderedTurnIds, turns.map((turn) => turn.turnId), 'Provider render batch turn coverage')
  } else if (orderedTurnIds.some((turnId) => !turns.some((turn) => turn.turnId === turnId))) {
    throw UsageError('Hybrid provider render batch references an unknown turn.')
  }
  for (const [batchIndex, batch] of plan.batches.entries()) {
    if (batch.orderedTurnIds.length === 0) throw UsageError('Provider render batch requires ordered turns.')
    assertUnique(batch.orderedTurnIds, 'Provider render batch turn IDs')
    validateTypedSettings(batch.requestControls, 'Provider batch request controls')
    validatePlannedCost(batch.plannedCost, 'Provider batch planned cost')
    if (batch.generationSlots.some((slot, index) =>
      slot.slotIndex !== index
      || !Number.isInteger(slot.requestedTakeCount)
      || slot.requestedTakeCount < 1
    )) {
      throw UsageError('Provider generation slots require contiguous zero-based indexes and positive take counts.')
    }
    for (const slot of batch.generationSlots) validatePlannedCost(slot.plannedCost, 'Provider generation-slot planned cost')
    if (batch.continuation.kind === 'prior-batch-selection') {
      const predecessorBatchId = batch.continuation.predecessorBatchId
      const predecessorIndex = plan.batches.findIndex((entry) => entry.batchId === predecessorBatchId)
      if (predecessorIndex < 0 || predecessorIndex >= batchIndex) {
        throw UsageError('Provider continuation must reference an earlier batch in the same render plan.')
      }
    }
  }
}
