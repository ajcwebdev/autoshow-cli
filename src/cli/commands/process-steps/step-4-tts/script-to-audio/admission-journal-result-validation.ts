import type { RenderAdmissionJournalSnapshot } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { assertUnique } from './contract-validation-primitives'

export const validateAdmissionJournalResults = (
  snapshot: RenderAdmissionJournalSnapshot,
  previous: RenderAdmissionJournalSnapshot | undefined,
  plannedSlots: readonly string[]
): void => {
  const batchResultIds = snapshot.recordedBatchResults.map((result) => result.batchResultId)
  assertUnique(batchResultIds, 'Recorded admission batch result IDs')
  for (const result of snapshot.recordedBatchResults) {
    if (!plannedSlots.includes(`${result.batchId}\0${result.generationSlotId}`)) {
      throw UsageError('Recorded batch result references an unplanned generation slot.')
    }
    const retainedFromPrevious = previous?.recordedBatchResults.some((oldResult) =>
      oldResult.batchResultId === result.batchResultId
      && oldResult.admissionBasisSnapshotId === result.admissionBasisSnapshotId
    ) ?? false
    if (
      previous
      && !retainedFromPrevious
      && result.admissionBasisSnapshotId !== snapshot.snapshotId
      && result.admissionBasisSnapshotId !== snapshot.previousSnapshotId
    ) {
      throw UsageError('Recorded batch result has no exact admission-basis snapshot in this journal chain.')
    }
  }
  if (snapshot.recordedResult && snapshot.recordedBatchResults.length === 0 && snapshot.requests.length > 0) {
    throw UsageError('Aggregate provider result cannot omit batch results after provider requests were prepared.')
  }
}
