import type { RenderAdmissionJournalSnapshot } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/value-helpers'
import { assertContentIdentity, assertSafeArtifactRelativePath, hashCanonicalTtsValue } from './contract-identity'
import { assertIsoDate, assertSha256, assertUnique, canonicalTtsJsonForValidation, SHA256 } from './contract-validation-primitives'

export const assertContiguousSequences = (
  values: readonly number[],
  label: string,
  start = 1
): void => {
  if (values.some((value, index) => !Number.isInteger(value) || value !== index + start)) {
    throw UsageError(`${label} must use contiguous ordered sequences beginning at ${start}.`)
  }
}

export const validateAdmissionProofRef = (
  proof: unknown,
  expected: {
    kind: 'acceptance' | 'completion' | 'rejection' | 'ambiguity' | 'not-admitted'
    journalId: string
    invocationId: string
    requestOrdinal: number
    requestFingerprint: string
  }
): void => {
  if (
    !isRecord(proof)
    || proof['journalId'] !== expected.journalId
    || proof['invocationId'] !== expected.invocationId
    || proof['requestOrdinal'] !== expected.requestOrdinal
    || proof['requestFingerprint'] !== expected.requestFingerprint
    || proof['proofKind'] !== expected.kind
  ) {
    throw UsageError(`Admission ${expected.kind} proof does not bind the exact journal request.`)
  }
  if (proof['kind'] === 'sanitized-artifact') {
    if (typeof proof['path'] !== 'string' || typeof proof['sha256'] !== 'string') {
      throw UsageError(`Admission ${expected.kind} proof requires a contained artifact and checksum.`)
    }
    assertSafeArtifactRelativePath(proof['path'], 'attempt')
    assertSha256(proof['sha256'], `Admission ${expected.kind} proof checksum`)
    return
  }
  if (proof['kind'] === 'protected-asset') {
    const asset = proof['asset']
    if (
      !isRecord(asset)
      || typeof asset['storeId'] !== 'string'
      || asset['storeId'].trim().length === 0
      || typeof asset['assetId'] !== 'string'
      || asset['assetId'].trim().length === 0
      || typeof asset['sha256'] !== 'string'
    ) {
      throw UsageError(`Admission ${expected.kind} protected proof has an invalid asset reference.`)
    }
    assertSha256(asset['sha256'], `Admission ${expected.kind} protected proof checksum`)
    return
  }
  throw UsageError(`Admission ${expected.kind} proof has an invalid storage kind.`)
}

export const validateAdmissionTransitions = (
  snapshot: RenderAdmissionJournalSnapshot,
  request: RenderAdmissionJournalSnapshot['requests'][number]
): void => {
  assertContiguousSequences(request.transitions.map((transition) => transition.sequence), 'Admission transition sequence')
  const states = request.transitions.map((transition) => transition.state)
  if (states[0] !== 'prepared') {
    throw UsageError('Admission transitions must begin with prepared.')
  }
  for (const transition of request.transitions) {
    assertIsoDate(transition.at, `Admission ${transition.state} transition`)
    if (transition.state === 'prepared') {
      assertSha256(transition.requestBodyHash, 'Admission prepared request-body hash')
    } else if (transition.state === 'dispatch-started') {
      assertSha256(transition.transportEvidenceHash, 'Admission dispatch transport-evidence hash')
    } else if (transition.state === 'provider-accepted') {
      if (transition.providerRequestId !== undefined && transition.providerRequestId.trim().length === 0) {
        throw UsageError('Admission provider acceptance has an empty provider request ID.')
      }
      validateAdmissionProofRef(transition.evidence, {
        kind: 'acceptance',
        journalId: snapshot.journalId,
        invocationId: snapshot.invocationId,
        requestOrdinal: request.requestOrdinal,
        requestFingerprint: request.requestFingerprint
      })
    } else if (transition.state === 'completed') {
      validateAdmissionProofRef(transition.evidence, {
        kind: 'completion',
        journalId: snapshot.journalId,
        invocationId: snapshot.invocationId,
        requestOrdinal: request.requestOrdinal,
        requestFingerprint: request.requestFingerprint
      })
    } else if (transition.state === 'provider-rejected') {
      validateAdmissionProofRef(transition.evidence, {
        kind: 'rejection',
        journalId: snapshot.journalId,
        invocationId: snapshot.invocationId,
        requestOrdinal: request.requestOrdinal,
        requestFingerprint: request.requestFingerprint
      })
    } else if (transition.state === 'ambiguous' && transition.evidence !== undefined) {
      validateAdmissionProofRef(transition.evidence, {
        kind: 'ambiguity',
        journalId: snapshot.journalId,
        invocationId: snapshot.invocationId,
        requestOrdinal: request.requestOrdinal,
        requestFingerprint: request.requestFingerprint
      })
    } else if (transition.state === 'confirmed-not-admitted') {
      validateAdmissionProofRef(transition.evidence, {
        kind: 'not-admitted',
        journalId: snapshot.journalId,
        invocationId: snapshot.invocationId,
        requestOrdinal: request.requestOrdinal,
        requestFingerprint: request.requestFingerprint
      })
    }
  }

  if (states.length === 1) return
  if (states[1] === 'confirmed-not-admitted') {
    const transition = request.transitions[1]
    if (states.length !== 2 || transition?.state !== 'confirmed-not-admitted' || transition.method !== 'local-before-dispatch') {
      throw UsageError('Only local-before-dispatch confirmation may close a prepared request without dispatch.')
    }
    return
  }
  if (states[1] !== 'dispatch-started') {
    throw UsageError('Admission may advance from prepared only to dispatch-started or local no-admission proof.')
  }
  const afterDispatch = states.slice(2)
  if (afterDispatch.length === 0) return
  if (afterDispatch[0] === 'provider-accepted') {
    if (afterDispatch.length > 2 || (afterDispatch.length === 2 && afterDispatch[1] !== 'completed')) {
      throw UsageError('Provider acceptance may advance only to completion.')
    }
    return
  }
  if (afterDispatch.length !== 1) {
    throw UsageError('A dispatched request may have only one terminal rejection, ambiguity, or no-admission result.')
  }
  if (afterDispatch[0] === 'provider-rejected' || afterDispatch[0] === 'ambiguous') return
  const transition = request.transitions[2]
  if (
    afterDispatch[0] === 'confirmed-not-admitted'
    && transition?.state === 'confirmed-not-admitted'
    && transition.method !== 'local-before-dispatch'
  ) return
  throw UsageError('Admission request contains an invalid post-dispatch transition.')
}

export const validateRenderAdmissionJournalSnapshot = (
  snapshot: RenderAdmissionJournalSnapshot,
  previous?: RenderAdmissionJournalSnapshot | undefined
): RenderAdmissionJournalSnapshot => {
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
  assertContiguousSequences(snapshot.requests.map((request) => request.requestOrdinal), 'Admission request ordinals')
  const deliberateRequests = snapshot.requests.filter((request) => request.retryOfRequestOrdinal === undefined)
  const deliberateSlots = deliberateRequests.map((request) => `${request.batchId}\0${request.generationSlotId}`)
  assertUnique(deliberateSlots, 'Admission deliberate request generation slots')
  if (deliberateRequests.length > snapshot.plannedRequestCount) {
    throw UsageError('Admission journal contains more deliberate requests than the priced generation-slot plan.')
  }
  for (const request of snapshot.requests) {
    if (!plannedSlots.includes(`${request.batchId}\0${request.generationSlotId}`)) {
      throw UsageError('Admission request references an unplanned generation slot.')
    }
    if (
      !request.batchInvocationPlanId.trim()
      || !request.batchInvocationPlanRef.trim()
      || !SHA256.test(request.batchInvocationPlanSha256)
      || !SHA256.test(request.requestFingerprint)
    ) {
      throw UsageError('Admission request requires a complete invocation-plan reference and request fingerprint.')
    }
    assertSafeArtifactRelativePath(request.batchInvocationPlanRef, 'attempt')
    validateAdmissionTransitions(snapshot, request)
    if (request.retryOfRequestOrdinal !== undefined) {
      const retried = snapshot.requests.find((candidate) => candidate.requestOrdinal === request.retryOfRequestOrdinal)
      if (
        request.retryOfRequestOrdinal >= request.requestOrdinal
        || !retried
        || request.batchId !== retried.batchId
        || request.generationSlotId !== retried.generationSlotId
        || request.batchInvocationPlanId !== retried.batchInvocationPlanId
        || request.batchInvocationPlanRef !== retried.batchInvocationPlanRef
        || request.batchInvocationPlanSha256 !== retried.batchInvocationPlanSha256
        || request.requestFingerprint !== retried.requestFingerprint
      ) {
        throw UsageError('Admission retry must link an earlier request with the identical slot, invocation plan, and fingerprint.')
      }
    }
  }
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
  if (previous) {
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
  return snapshot
}
