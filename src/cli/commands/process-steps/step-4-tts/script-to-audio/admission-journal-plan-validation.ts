import type { RenderAdmissionJournalSnapshot } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { assertContentIdentity, hashCanonicalTtsValue } from './contract-identity'
import { assertUnique, canonicalTtsJsonForValidation } from './contract-validation-primitives'

export const validateAdmissionJournalIdentityAndPlan = (
  snapshot: RenderAdmissionJournalSnapshot
): string[] => {
  if (snapshot.schemaVersion !== 1 || snapshot.plannedRequestCount < 0 || !Number.isInteger(snapshot.plannedRequestCount)) {
    throw UsageError('Render admission journal has an invalid schema or planned request count.')
  }
  const expectedJournalId = hashCanonicalTtsValue({
    renderPlanId: snapshot.renderPlanId,
    renderIdentity: snapshot.renderIdentity,
    attempt: snapshot.attempt,
    invocationId: snapshot.invocationId
  })
  if (snapshot.journalId !== expectedJournalId) {
    throw UsageError('Render admission journal ID does not bind its exact render, attempt, and invocation.')
  }
  assertContentIdentity(snapshot as unknown as Record<string, unknown>, 'snapshotId', 'Render admission journal snapshot')
  assertUnique(snapshot.plannedBatchIds, 'Admission journal planned batch IDs')
  const plannedSlots = snapshot.plannedGenerationSlots.map((slot) => `${slot.batchId}\0${slot.generationSlotId}`)
  assertUnique(plannedSlots, 'Admission journal planned generation slots')
  const expectedBatchIds = snapshot.plannedGenerationSlots.reduce<string[]>((batchIds, slot) => {
    if (!batchIds.includes(slot.batchId)) batchIds.push(slot.batchId)
    return batchIds
  }, [])
  if (canonicalTtsJsonForValidation(snapshot.plannedBatchIds) !== canonicalTtsJsonForValidation(expectedBatchIds)) {
    throw UsageError('Admission planned batch IDs must exactly match first occurrence order in the planned generation slots.')
  }
  if (snapshot.plannedRequestCount !== snapshot.plannedGenerationSlots.length) {
    throw UsageError('Admission planning requires exactly one deliberate request budget per generation slot.')
  }
  return plannedSlots
}
