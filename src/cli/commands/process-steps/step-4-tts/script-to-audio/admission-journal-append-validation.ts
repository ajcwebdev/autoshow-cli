import type { RenderAdmissionJournalSnapshot } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { canonicalTtsJsonForValidation } from './contract-validation-primitives'

export const validateAdmissionJournalAppendOnly = (
  snapshot: RenderAdmissionJournalSnapshot,
  previous: RenderAdmissionJournalSnapshot | undefined
): void => {
  if (!previous) return
  if (
    snapshot.journalId !== previous.journalId
    || snapshot.previousSnapshotId !== previous.snapshotId
    || snapshot.renderPlanId !== previous.renderPlanId
    || snapshot.renderIdentity !== previous.renderIdentity
    || snapshot.invocationId !== previous.invocationId
    || snapshot.attempt !== previous.attempt
  ) {
    throw UsageError('Admission journal snapshot does not extend the exact prior attempt snapshot.')
  }
  if (previous.requests.length > snapshot.requests.length) {
    throw UsageError('Admission journal snapshot cannot remove request records.')
  }
  for (const [index, oldRequest] of previous.requests.entries()) {
    const nextRequest = snapshot.requests[index]
    if (!nextRequest) {
      throw UsageError('Admission journal request prefix is append-only.')
    }
    const { transitions: oldTransitionsRaw, ...oldHeader } = oldRequest
    const { transitions: nextTransitionsRaw, ...nextHeader } = nextRequest
    if (canonicalTtsJsonForValidation(oldHeader) !== canonicalTtsJsonForValidation(nextHeader)) {
      throw UsageError('Admission journal request identity is immutable across snapshots.')
    }
    const oldTransitions = oldTransitionsRaw.map((transition) => canonicalTtsJsonForValidation(transition))
    const nextTransitions = nextTransitionsRaw.map((transition) => canonicalTtsJsonForValidation(transition))
    if (oldTransitions.some((transition, transitionIndex) => transition !== nextTransitions[transitionIndex])) {
      throw UsageError('Admission transitions are append-only across journal snapshots.')
    }
  }
  const oldBatchResults = previous.recordedBatchResults.map((result) => canonicalTtsJsonForValidation(result))
  const nextBatchResults = snapshot.recordedBatchResults.map((result) => canonicalTtsJsonForValidation(result))
  if (oldBatchResults.some((result, index) => result !== nextBatchResults[index])) {
    throw UsageError('Admission batch-result promotion is append-only across snapshots.')
  }
  if (
    previous.recordedResult !== undefined
    && canonicalTtsJsonForValidation(previous.recordedResult) !== canonicalTtsJsonForValidation(snapshot.recordedResult)
  ) {
    throw UsageError('Admission aggregate-result promotion is immutable once recorded.')
  }
}
