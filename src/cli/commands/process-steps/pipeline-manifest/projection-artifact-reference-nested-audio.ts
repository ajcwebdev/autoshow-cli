import { posix } from 'node:path'
import type { NestedCollector, ProjectionArtifactReference } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { isOpaqueProtectedAssetRef } from './guards'

const collectAudioRunNested: NestedCollector = (ctx) => {
  const { reference, value, renderDir, add } = ctx
  const audioRunDir = posix.dirname(reference.path)
  if (!renderDir || audioRunDir === '.') return false
  const context = { renderDir, audioRunDir }
  const providerResult = value['providerResult']
  if (!isRecord(providerResult) || !add(providerResult, 'path', 'sha256', 'provider-render-result', renderDir, {
    resultIdentity: providerResult['resultIdentity'] as string,
    renderPlanId: value['renderPlanId'] as string,
    renderIdentity: value['renderIdentity'] as string
  }, context)) return false
  const renderTakes = value['renderTakes']
  if (renderTakes !== undefined && (!isRecord(renderTakes) || !add(renderTakes, 'path', 'sha256', 'render-takes', renderDir, {
    renderTakesId: renderTakes['renderTakesId'] as string
  }, context))) return false
  for (const [key, kind] of [['takeSelections', 'take-selection'], ['continuationCheckpoints', 'continuation-checkpoint']] as const) {
    const list = value[key]
    if (!Array.isArray(list)) return false
    for (const item of list) if (!isRecord(item) || !add(item, 'path', 'sha256', kind, renderDir, undefined, context)) return false
  }
  for (const [key, kind, idKey] of [
    ['mixPlan', 'audio-mix-plan', 'mixPlanId'],
    ['transformLedger', 'audio-transform-ledger', 'transformLedgerId'],
    ['finalTimeline', 'final-timeline', 'timelineId']
  ] as const) {
    const item = value[key]
    if (!isRecord(item) || !add(item, 'path', 'sha256', kind, audioRunDir, {
      [idKey]: item[idKey] as string,
      renderIdentity: value['renderIdentity'] as string
    }, context)) return false
  }
  if (!Array.isArray(value['finalOutputs'])) return false
  for (const output of value['finalOutputs']) if (!isRecord(output) || !add(output, 'path', 'sha256', 'audio', audioRunDir, undefined, context)) return false
  return true
}

const collectFinalTimelineNested: NestedCollector = (ctx) => {
  const ledger = ctx.value['transformLedgerRef']
  const audioRunDir = ctx.reference.context?.audioRunDir
  if (!audioRunDir) return true
  return isRecord(ledger) && ctx.add(ledger, 'path', 'sha256', 'audio-transform-ledger', audioRunDir, {
    renderIdentity: ctx.value['renderIdentity'] as string
  }, ctx.reference.context)
}

const collectRenderTakesNested: NestedCollector = (ctx) => {
  const { value, renderDir, add } = ctx
  if (!renderDir || !Array.isArray(value['generationSlots'])) return false
  for (const slot of value['generationSlots']) {
    if (!isRecord(slot) || !isRecord(slot['batchResult']) || !add(slot['batchResult'], 'artifactRef', 'sha256', 'provider-batch-result', renderDir, {
      batchResultId: slot['batchResult']['batchResultId'] as string
    }, { renderDir })) return false
  }
  return true
}

const collectTakeSelectionNested: NestedCollector = (ctx) => {
  const { value, renderDir, add } = ctx
  if (!renderDir || !Array.isArray(value['batchResults'])) return false
  for (const result of value['batchResults']) if (!isRecord(result) || !add(result, 'artifactRef', 'sha256', 'provider-batch-result', renderDir, {
    batchResultId: result['batchResultId'] as string
  }, { renderDir })) return false
  return true
}

const collectContinuationCheckpointNested: NestedCollector = (ctx) => {
  const { value, renderDir, add } = ctx
  const result = value['batchResult']
  const selection = value['selection']
  if (
    !renderDir
    || !isRecord(result)
    || !add(result, 'artifactRef', 'sha256', 'provider-batch-result', renderDir, { batchResultId: result['batchResultId'] as string }, { renderDir })
    || !isRecord(selection)
    || !add(selection, 'path', 'sha256', 'take-selection', renderDir, { selectionId: selection['selectionId'] as string }, { renderDir })
  ) return false
  const state = value['continuationState']
  return !(isRecord(state) && state['kind'] === 'protected-token' && !isOpaqueProtectedAssetRef(state['asset']))
}

export const AUDIO_NESTED_COLLECTORS: Partial<Record<ProjectionArtifactReference['kind'], NestedCollector>> = {
  'audio-run': collectAudioRunNested,
  'final-timeline': collectFinalTimelineNested,
  'render-takes': collectRenderTakesNested,
  'take-selection': collectTakeSelectionNested,
  'continuation-checkpoint': collectContinuationCheckpointNested
}
