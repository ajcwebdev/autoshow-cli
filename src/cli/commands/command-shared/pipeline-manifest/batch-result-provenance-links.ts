import type { GraphLinkContext } from '~/types'
import { isRecord } from '~/utils/rest-client'

type BatchResultRecord = NonNullable<ReturnType<GraphLinkContext['batchResults']['get']>>

const resolveBatchProvenanceEvidence = (ctx: GraphLinkContext, batch: BatchResultRecord) => {
  const value = batch.value
  const attemptDir = batch.reference.context?.attemptDir
    ?? (batch.reference.path.includes('/batch-results/') ? batch.reference.path.slice(0, batch.reference.path.indexOf('/batch-results/')) : undefined)
  const invocationRef = value['batchInvocationPlan']
  const admissionBasis = value['admissionBasis']
  if (!attemptDir || !isRecord(invocationRef) || !isRecord(admissionBasis)) return undefined
  const invocationPath = ctx.resolveFrom(attemptDir, invocationRef['artifactRef'])
  const invocationPlan = invocationPath ? ctx.checkedProviderPath(invocationPath)?.json : undefined
  const basis = typeof admissionBasis['snapshotId'] === 'string' ? ctx.admissionSnapshots.get(admissionBasis['snapshotId']) : undefined
  if (
    !invocationPlan
    || invocationPlan['batchInvocationPlanId'] !== invocationRef['batchInvocationPlanId']
    || ctx.checkedProviderPath(invocationPath as string)?.sha256 !== invocationRef['sha256']
    || invocationPlan['requestFingerprint'] === undefined
    || !basis
    || !Array.isArray(basis.value['requests'])
    || basis.value['journalId'] !== admissionBasis['journalId']
    || basis.value['invocationId'] !== value['invocationId']
  ) return undefined
  const journalRequests = basis.value['requests'].filter((request) =>
    isRecord(request)
    && request['batchId'] === value['batchId']
    && request['generationSlotId'] === value['generationSlotId']
  )
  return { value, invocationRef, invocationPlan, journalRequests }
}

type BatchProvenanceEvidence = NonNullable<ReturnType<typeof resolveBatchProvenanceEvidence>>

const validateObservedBatchRequests = ({ value, invocationRef, invocationPlan, journalRequests }: BatchProvenanceEvidence): boolean => {
  const observedRequests = value['observedRequests']
  if (!Array.isArray(observedRequests) || journalRequests.length !== observedRequests.length) return false
  for (const rawObserved of observedRequests) {
    if (!isRecord(rawObserved) || !Number.isInteger(rawObserved['requestOrdinal'])) return false
    const matching = journalRequests.filter((request) => isRecord(request) && request['requestOrdinal'] === rawObserved['requestOrdinal'])
    const journalRequest = matching[0]
    if (!isRecord(journalRequest) || matching.length !== 1 || !Array.isArray(journalRequest['transitions'])) return false
    const prepared = journalRequest['transitions'].find((transition) => isRecord(transition) && transition['state'] === 'prepared')
    if (
      !isRecord(prepared)
      || rawObserved['invocationId'] !== value['invocationId']
      || rawObserved['batchId'] !== value['batchId']
      || rawObserved['generationSlotId'] !== value['generationSlotId']
      || rawObserved['batchInvocationPlanId'] !== invocationRef['batchInvocationPlanId']
      || rawObserved['requestBodyHash'] !== prepared['requestBodyHash']
      || journalRequest['batchInvocationPlanId'] !== invocationRef['batchInvocationPlanId']
      || journalRequest['batchInvocationPlanRef'] !== invocationRef['artifactRef']
      || journalRequest['batchInvocationPlanSha256'] !== invocationRef['sha256']
      || journalRequest['requestFingerprint'] !== invocationPlan['requestFingerprint']
    ) return false
  }
  return true
}

const validateBatchRetryMetadata = ({ value, journalRequests }: BatchProvenanceEvidence): boolean => {
  if (journalRequests.some((request) =>
    isRecord(request)
    && request['retryOfRequestOrdinal'] !== undefined
    && (!Array.isArray(value['retryAttempts']) || !value['retryAttempts'].some((retry) =>
      isRecord(retry)
      && retry['requestOrdinal'] === request['requestOrdinal']
      && retry['retryOfRequestOrdinal'] === request['retryOfRequestOrdinal']
      && retry['invocationId'] === value['invocationId']
    ))
  )) return false
  return true
}

const validateSuccessfulBatchRetryChain = (journalRequests: unknown[]): boolean => {
  const requestsByOrdinal = new Map<number, Record<string, unknown>>()
  const completed: Record<string, unknown>[] = []
  for (const request of journalRequests) {
    if (!isRecord(request) || !Number.isInteger(request['requestOrdinal']) || !Array.isArray(request['transitions'])) return false
    const ordinal = request['requestOrdinal'] as number
    if (requestsByOrdinal.has(ordinal)) return false
    requestsByOrdinal.set(ordinal, request)
    const terminalState = request['transitions'].at(-1)
    if (isRecord(terminalState) && terminalState['state'] === 'completed') completed.push(request)
  }
  if (completed.length !== 1) return false
  const retryChain = new Set<number>()
  let request: Record<string, unknown> | undefined = completed[0]
  while (request) {
    const ordinal = request['requestOrdinal'] as number
    if (retryChain.has(ordinal)) return false
    retryChain.add(ordinal)
    const parentOrdinal = request['retryOfRequestOrdinal']
    if (parentOrdinal === undefined) break
    if (!Number.isInteger(parentOrdinal)) return false
    request = requestsByOrdinal.get(parentOrdinal as number)
    if (!request) return false
  }
  if (retryChain.size !== journalRequests.length) return false
  return true
}

export const validateBatchResultProvenanceLinks = (ctx: GraphLinkContext): boolean => {
  for (const batch of ctx.batchResults.values()) {
    if (batch.value['provenance'] !== 'provider-dispatch') continue
    const evidence = resolveBatchProvenanceEvidence(ctx, batch)
    if (!evidence || !validateObservedBatchRequests(evidence) || !validateBatchRetryMetadata(evidence)) return false
    if (batch.value['status'] === 'succeeded' && !validateSuccessfulBatchRetryChain(evidence.journalRequests)) return false
  }
  return true
}
