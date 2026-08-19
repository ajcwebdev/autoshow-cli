import type { AggregateBatchLinks, GraphLinkContext, PlannedSlot } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { canonicalManifestJson } from './guards'

export const validateProviderBatchResultLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('provider-batch-result')) {
    const value = ctx.jsonAt(reference)
    const batchResultId = value?.['batchResultId']
    if (!value || typeof batchResultId !== 'string') return false
    const prior = ctx.batchResults.get(batchResultId)
    if (prior && (prior.reference.path !== reference.path || prior.reference.sha256 !== reference.sha256)) return false
    ctx.batchResults.set(batchResultId, { reference, value })
  }
  return true
}

const collectPlannedTurnIds = (nodes: readonly unknown[]): string[] =>
  nodes.flatMap((node) => {
    if (!isRecord(node)) return []
    if (node['kind'] === 'turn' && isRecord(node['turn']) && typeof node['turn']['turnId'] === 'string') {
      return [node['turn']['turnId']]
    }
    if (node['kind'] !== 'overlap' || !Array.isArray(node['turns'])) return []
    return node['turns'].flatMap((turn) =>
      isRecord(turn) && typeof turn['turnId'] === 'string' ? [turn['turnId']] : [])
  })

const collectPlannedSlots = (
  batches: readonly unknown[]
): Map<string, PlannedSlot> | undefined => {
  const plannedSlots = new Map<string, PlannedSlot>()
  for (const rawBatch of batches) {
    if (
      !isRecord(rawBatch)
      || typeof rawBatch['batchId'] !== 'string'
      || !Array.isArray(rawBatch['orderedTurnIds'])
      || !rawBatch['orderedTurnIds'].every((turnId) => typeof turnId === 'string')
      || !Array.isArray(rawBatch['generationSlots'])
    ) return undefined
    for (const rawSlot of rawBatch['generationSlots']) {
      if (!isRecord(rawSlot) || typeof rawSlot['generationSlotId'] !== 'string') return undefined
      const key = `${rawBatch['batchId']}\0${rawSlot['generationSlotId']}`
      if (plannedSlots.has(key)) return undefined
      plannedSlots.set(key, {
        batchId: rawBatch['batchId'],
        generationSlotId: rawSlot['generationSlotId'],
        orderedTurnIds: [...rawBatch['orderedTurnIds']]
      })
    }
  }
  return plannedSlots
}

const collectAggregateBatchLinks = (
  ctx: GraphLinkContext,
  value: Record<string, unknown>,
  renderDir: string,
  plannedSlots: ReadonlyMap<string, PlannedSlot>
): AggregateBatchLinks | undefined => {
  if (!Array.isArray(value['batchResults'])) return undefined
  const links: AggregateBatchLinks = { pairs: [], batches: [] }
  for (const rawResult of value['batchResults']) {
    if (!isRecord(rawResult) || typeof rawResult['batchResultId'] !== 'string') return undefined
    const batch = ctx.batchResults.get(rawResult['batchResultId'])
    const expectedPath = ctx.resolveFrom(renderDir, rawResult['artifactRef'])
    const pair = `${rawResult['batchId']}\0${rawResult['generationSlotId']}`
    const planned = plannedSlots.get(pair)
    if (
      !batch
      || !planned
      || !expectedPath
      || batch.reference.path !== expectedPath
      || batch.reference.sha256 !== rawResult['sha256']
      || batch.value['renderPlanId'] !== value['renderPlanId']
      || batch.value['renderIdentity'] !== value['renderIdentity']
      || batch.value['batchId'] !== rawResult['batchId']
      || batch.value['generationSlotId'] !== rawResult['generationSlotId']
      || canonicalManifestJson(batch.value['requestedTurnIds']) !== canonicalManifestJson(planned.orderedTurnIds)
    ) return undefined
    links.pairs.push(pair)
    links.batches.push(batch.value)
  }
  return links
}

const validateAggregatePairCoverage = (
  value: Record<string, unknown>,
  plannedSlots: ReadonlyMap<string, PlannedSlot>,
  aggregatePairs: readonly string[]
): boolean => {
  if (new Set(aggregatePairs).size !== aggregatePairs.length) return false
  const aggregatePairSet = new Set(aggregatePairs)
  const plannedAggregatePairs = [...plannedSlots.keys()].filter((pair) => aggregatePairSet.has(pair))
  if (canonicalManifestJson(aggregatePairs) !== canonicalManifestJson(plannedAggregatePairs)) return false
  return value['status'] !== 'succeeded'
    || canonicalManifestJson(aggregatePairs) === canonicalManifestJson([...plannedSlots.keys()])
}

const validateAggregateOutputs = (
  ctx: GraphLinkContext,
  outputs: readonly unknown[]
): boolean =>
  outputs.every((rawOutput) => {
    if (!isRecord(rawOutput)) return false
    const resolved = ctx.batchOutput(rawOutput['batchResultId'], rawOutput['outputId'])
    return resolved !== undefined
      && canonicalManifestJson(rawOutput) === canonicalManifestJson({
        ...resolved.output,
        batchResultId: rawOutput['batchResultId']
      })
  })

const validateGeneratedBatches = (
  generatedBatches: unknown,
  aggregateBatches: readonly Record<string, unknown>[]
): boolean => {
  if (!Array.isArray(generatedBatches)) return true
  return generatedBatches.every((generated) => {
    if (!isRecord(generated)) return false
    const matches = aggregateBatches.filter((batch) =>
      batch['batchId'] === generated['batchId']
      && batch['generationSlotId'] === generated['generationSlotId'])
    return matches.length === 1
      && canonicalManifestJson(matches[0]?.['generatedBatch']) === canonicalManifestJson(generated)
  })
}

const compareRequestRecords = (
  left: Record<string, unknown>,
  right: Record<string, unknown>
): number =>
  String(left['invocationId']).localeCompare(String(right['invocationId']))
  || Number(left['requestOrdinal']) - Number(right['requestOrdinal'])

const validateAggregateRecordCollection = (
  value: Record<string, unknown>,
  aggregateBatches: readonly Record<string, unknown>[],
  key: 'observedRequests' | 'retryAttempts'
): boolean => {
  const aggregateValue = value[key]
  if (!Array.isArray(aggregateValue)) return false
  const aggregateRecords = aggregateValue.filter(isRecord).sort(compareRequestRecords)
  const batchRecords = aggregateBatches
    .flatMap((batch) => Array.isArray(batch[key]) ? batch[key].filter(isRecord) : [])
    .sort(compareRequestRecords)
  return aggregateRecords.length === aggregateValue.length
    && canonicalManifestJson(aggregateRecords) === canonicalManifestJson(batchRecords)
}

const validateTurnOutcomes = (
  outcomes: unknown,
  plannedSlots: ReadonlyMap<string, PlannedSlot>
): boolean => {
  if (!Array.isArray(outcomes)) return false
  for (const rawOutcome of outcomes) {
    if (
      !isRecord(rawOutcome)
      || typeof rawOutcome['turnId'] !== 'string'
      || !Array.isArray(rawOutcome['batchIds'])
      || !Array.isArray(rawOutcome['generationSlotIds'])
      || rawOutcome['batchIds'].length !== rawOutcome['generationSlotIds'].length
    ) return false
    for (let index = 0; index < rawOutcome['batchIds'].length; index += 1) {
      const planned = plannedSlots.get(`${rawOutcome['batchIds'][index]}\0${rawOutcome['generationSlotIds'][index]}`)
      if (!planned || !planned.orderedTurnIds.includes(rawOutcome['turnId'])) return false
    }
  }
  return true
}

const validateProviderRenderResultLink = (
  ctx: GraphLinkContext,
  value: Record<string, unknown>,
  renderDir: string
): boolean => {
  if (!Array.isArray(value['outputs'])) return false
  const renderPlan = typeof value['renderPlanId'] === 'string'
    ? ctx.renderPlansById.get(value['renderPlanId'])
    : undefined
  if (!renderPlan || !Array.isArray(renderPlan['batches']) || !Array.isArray(renderPlan['nodes'])) return false
  if (canonicalManifestJson(value['requestedTurnIds']) !== canonicalManifestJson(collectPlannedTurnIds(renderPlan['nodes']))) return false
  const plannedSlots = collectPlannedSlots(renderPlan['batches'])
  if (!plannedSlots) return false
  const aggregate = collectAggregateBatchLinks(ctx, value, renderDir, plannedSlots)
  return aggregate !== undefined
    && validateAggregatePairCoverage(value, plannedSlots, aggregate.pairs)
    && validateAggregateOutputs(ctx, value['outputs'])
    && validateGeneratedBatches(value['generatedBatches'], aggregate.batches)
    && validateAggregateRecordCollection(value, aggregate.batches, 'observedRequests')
    && validateAggregateRecordCollection(value, aggregate.batches, 'retryAttempts')
    && validateTurnOutcomes(value['turnOutcomes'], plannedSlots)
}

export const validateProviderRenderResultLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('provider-render-result')) {
    const value = ctx.jsonAt(reference)
    const renderDir = reference.context?.renderDir
    if (!value || !renderDir || !validateProviderRenderResultLink(ctx, value, renderDir)) return false
  }
  return true
}
