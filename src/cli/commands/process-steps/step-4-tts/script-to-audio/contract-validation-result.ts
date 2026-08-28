import type { CacheMaterializationPlan, ProviderBatchResult, ProviderRenderResult } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { assertContentIdentity } from './contract-identity'
import { assertExactStringSet, assertUnique, validateObservedProviderRequest, validatePlannedAndObservedCost } from './contract-validation-primitives'

export const validateProviderBatchResult = (
  result: ProviderBatchResult
): ProviderBatchResult => {
  if (result.schemaVersion !== 1) throw UsageError('Provider batch result requires schemaVersion 1.')
  assertContentIdentity(result as unknown as Record<string, unknown>, 'batchResultId', 'Provider batch result')
  assertUnique(result.requestedTurnIds, 'Provider batch requested turn IDs')
  validatePlannedAndObservedCost(result.cost, 'Provider batch result')
  assertUnique(result.outputs.map((output) => output.outputId), 'Provider batch output IDs')
  assertExactStringSet(
    result.turnOutcomes.map((outcome) => outcome.turnId),
    result.requestedTurnIds,
    'Provider batch turn outcomes'
  )
  const outputIds = new Set(result.outputs.map((output) => output.outputId))
  for (const outcome of result.turnOutcomes) {
    if (outcome.outputIds.some((outputId) => !outputIds.has(outputId))) {
      throw UsageError('Provider batch turn outcome references an unknown output.')
    }
    if (outcome.status === 'succeeded' && outcome.outputIds.length === 0) {
      throw UsageError('Succeeded provider batch turn requires at least one linked output.')
    }
    if (outcome.status !== 'succeeded' && outcome.outputIds.length > 0) {
      throw UsageError('Non-succeeded provider batch turn cannot claim a completed output.')
    }
  }
  if (result.status === 'succeeded') {
    if (
      result.outputs.length === 0
      || result.turnOutcomes.length !== result.requestedTurnIds.length
      || result.turnOutcomes.some((outcome) => outcome.status !== 'succeeded')
    ) {
      throw UsageError('Succeeded provider batch requires output and succeeded outcomes for every turn.')
    }
  }
  if (result.provenance === 'slot-reuse') {
    if (!result.slotHash.trim() || result.observedRequests.length !== 0 || result.retryAttempts.length !== 0 || result.createdResources.length !== 0) {
      throw UsageError('Slot-reuse batch result must list one slot hash and cannot claim provider dispatch, retry, or created resources.')
    }
  } else if (result.status === 'succeeded' && result.observedRequests.length === 0) {
    throw UsageError('Provider-dispatch success requires at least one serializer-observed request.')
  }
  const observedRequestKeys = result.observedRequests.map((request) => `${request.invocationId}\0${request.requestOrdinal}`)
  assertUnique(observedRequestKeys, 'Provider batch observed request identities')
  for (const request of result.observedRequests) {
    validateObservedProviderRequest(request)
    if (
      request.batchId !== result.batchId
      || request.generationSlotId !== result.generationSlotId
      || (result.provenance === 'provider-dispatch' && (
        request.invocationId !== result.invocationId
        || request.batchInvocationPlanId !== result.batchInvocationPlan.batchInvocationPlanId
      ))
      || request.turns.some((turn) => !result.requestedTurnIds.includes(turn.turnId))
    ) {
      throw UsageError('Observed provider request does not belong to its exact batch invocation and requested turn set.')
    }
    assertUnique(request.turns.map((turn) => turn.turnId), 'Observed provider request turns')
  }
  if (result.provenance === 'provider-dispatch' && result.status === 'succeeded') {
    const observedTurnIds = new Set(result.observedRequests.flatMap((request) => request.turns.map((turn) => turn.turnId)))
    if (
      observedTurnIds.size !== result.requestedTurnIds.length
      || result.requestedTurnIds.some((turnId) => !observedTurnIds.has(turnId))
    ) {
      throw UsageError('Succeeded provider dispatch must serializer-observe every requested turn.')
    }
  }
  for (const retry of result.retryAttempts) {
    if (
      retry.invocationId !== (result.provenance === 'provider-dispatch' ? result.invocationId : '')
      || retry.retryOfRequestOrdinal >= retry.requestOrdinal
      || !result.observedRequests.some((request) => request.requestOrdinal === retry.requestOrdinal)
      || !result.observedRequests.some((request) => request.requestOrdinal === retry.retryOfRequestOrdinal)
    ) {
      throw UsageError('Provider retry record does not link two ordered observed requests from the same invocation.')
    }
  }
  if (result.generatedBatch) {
    if (result.generatedBatch.batchId !== result.batchId || result.generatedBatch.generationSlotId !== result.generationSlotId) {
      throw UsageError('Generated batch identity does not match its provider batch result.')
    }
    assertUnique(result.generatedBatch.takes.map((take) => take.takeId), 'Generated take IDs')
    validatePlannedAndObservedCost(result.generatedBatch.batchCost, 'Generated provider batch')
    for (const take of result.generatedBatch.takes) {
      if (take.generationSlotId !== result.generationSlotId || (take.audio.outputId && !outputIds.has(take.audio.outputId))) {
        throw UsageError('Generated take does not bind the result generation slot and one of its outputs.')
      }
    }
  }
  return result
}

export const validateProviderRenderResult = (
  result: ProviderRenderResult
): ProviderRenderResult => {
  if (result.schemaVersion !== 1) throw UsageError('Provider render result requires schemaVersion 1.')
  assertContentIdentity(result as unknown as Record<string, unknown>, 'resultIdentity', 'Provider render result')
  assertUnique(result.requestedTurnIds, 'Provider render requested turn IDs')
  validatePlannedAndObservedCost(result.cost.currentComposition, 'Provider render current composition')
  validatePlannedAndObservedCost(result.cost.closingAttempt, 'Provider render closing attempt')
  validatePlannedAndObservedCost(result.cost.cumulativeRenderHistory, 'Provider render cumulative history')
  assertUnique(result.batchResults.map((entry) => entry.batchResultId), 'Provider render batch result IDs')
  assertUnique(result.outputs.map((entry) => `${entry.batchResultId}\0${entry.outputId}`), 'Provider render output IDs')
  assertUnique(result.outputs.map((entry) => entry.outputId), 'Provider render globally addressable output IDs')
  assertExactStringSet(
    result.turnOutcomes.map((outcome) => outcome.turnId),
    result.requestedTurnIds,
    'Provider render turn outcomes'
  )
  if (result.status === 'succeeded') {
    if (result.outputs.length === 0 || result.turnOutcomes.length !== result.requestedTurnIds.length || result.turnOutcomes.some((outcome) => outcome.status !== 'succeeded')) {
      throw UsageError('Succeeded provider render requires output and succeeded outcomes for every requested turn.')
    }
  }
  const observedKeys = result.observedRequests.map((request) => `${request.invocationId}\0${request.requestOrdinal}`)
  assertUnique(observedKeys, 'Provider render observed request identities')
  const batchIds = new Set(result.batchResults.map((entry) => entry.batchId))
  const generationSlotIds = new Set(result.batchResults.map((entry) => entry.generationSlotId))
  const aggregateOutputIds = new Set(result.outputs.map((output) => output.outputId))
  const batchResultIds = new Set(result.batchResults.map((entry) => entry.batchResultId))
  if (result.outputs.some((output) => !batchResultIds.has(output.batchResultId))) {
    throw UsageError('Provider render output references an unknown batch result.')
  }
  for (const request of result.observedRequests) {
    validateObservedProviderRequest(request)
    if (
      !batchIds.has(request.batchId)
      || !generationSlotIds.has(request.generationSlotId)
      || request.turns.some((turn) => !result.requestedTurnIds.includes(turn.turnId))
    ) {
      throw UsageError('Observed provider request references an unknown batch, slot, or turn in the aggregate result.')
    }
  }
  for (const outcome of result.turnOutcomes) {
    for (const request of outcome.observedRequests) {
      if (!observedKeys.includes(`${request.invocationId}\0${request.requestOrdinal}`)) {
        throw UsageError('Turn outcome references an unknown observed provider request.')
      }
    }
    if (
      outcome.batchIds.some((batchId) => !batchIds.has(batchId))
      || outcome.generationSlotIds.some((slotId) => !generationSlotIds.has(slotId))
      || outcome.outputIds.some((outputId) => !aggregateOutputIds.has(outputId))
    ) {
      throw UsageError('Turn outcome references an unknown batch, generation slot, or output.')
    }
    if (
      outcome.status === 'succeeded'
      && (
        outcome.outputIds.length === 0
        || (result.closedBy.kind === 'provider-attempt'
          && outcome.observedRequests.length === 0
          && outcome.generationSlotIds.some((slotId) => result.observedRequests.some((request) => request.generationSlotId === slotId)))
      )
    ) {
      throw UsageError('Succeeded provider render turn requires output linkage and provider-attempt observation when dispatched.')
    }
  }
  for (const batch of result.generatedBatches) {
    if (!batchIds.has(batch.batchId) || !generationSlotIds.has(batch.generationSlotId)) {
      throw UsageError('Generated provider batch does not belong to the aggregate result plan.')
    }
  }
  return result
}

export const validateCacheMaterializationPlan = (
  plan: CacheMaterializationPlan
): CacheMaterializationPlan => {
  if (plan.schemaVersion !== 1) throw UsageError('Cache materialization plan requires schemaVersion 1.')
  assertContentIdentity(plan as unknown as Record<string, unknown>, 'cacheMaterializationPlanId', 'Cache materialization plan')
  if (!plan.portableSemanticInputHash.trim() || !plan.currentExecutionInputHash.trim()) {
    throw UsageError('Cache materialization requires portable and current execution input identities.')
  }
  if (plan.resolvedContinuation.kind === 'none' && plan.continuationFingerprint.kind !== 'none') {
    throw UsageError('Cache continuation fingerprint must be none when no continuation is resolved.')
  }
  if (plan.resolvedContinuation.kind === 'checkpoint' && plan.continuationFingerprint.kind !== 'checkpoint') {
    throw UsageError('Cache checkpoint materialization requires a checkpoint semantic fingerprint.')
  }
  return plan
}
