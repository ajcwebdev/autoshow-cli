import type { RenderAdmissionJournalSnapshot } from '~/types'
import { validateAdmissionJournalAppendOnly } from './admission-journal-append-validation'
import { validateAdmissionJournalIdentityAndPlan } from './admission-journal-plan-validation'
import {
  validateAdmissionJournalRequests,
  validateAdmissionProofRef,
  validateAdmissionTransitions,
  assertContiguousSequences
} from './admission-journal-request-validation'
import { validateAdmissionJournalResults } from './admission-journal-result-validation'

export { assertContiguousSequences, validateAdmissionProofRef, validateAdmissionTransitions }

export const validateRenderAdmissionJournalSnapshot = (
  snapshot: RenderAdmissionJournalSnapshot,
  previous?: RenderAdmissionJournalSnapshot | undefined
): RenderAdmissionJournalSnapshot => {
  const plannedSlots = validateAdmissionJournalIdentityAndPlan(snapshot)
  validateAdmissionJournalRequests(snapshot, plannedSlots)
  validateAdmissionJournalResults(snapshot, previous, plannedSlots)
  validateAdmissionJournalAppendOnly(snapshot, previous)
  return snapshot
}
