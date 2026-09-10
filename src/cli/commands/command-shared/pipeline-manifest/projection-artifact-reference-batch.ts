import type { ProjectionArtifactReference, RenderCollectorContext } from '~/types'
import { isRecord } from '~/utils/rest-client'

const collectProviderDispatch = (slot: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  const plan = slot['batchInvocationPlan']
  const result = slot['batchResult']
  if (!isRecord(plan)) return false
  if (!ctx.sink.addFile(plan, {
    pathKey: 'path',
    shaKey: 'sha256',
    kind: 'batch-invocation-plan',
    expectedJsonFields: typeof plan['batchInvocationPlanId'] === 'string' ? { batchInvocationPlanId: plan['batchInvocationPlanId'] } : undefined,
    baseDir: ctx.renderDir,
    context: { renderDir: ctx.renderDir }
  })) return false
  if (result === undefined) return true
  if (!isRecord(result)) return false
  return ctx.sink.addFile(result, {
    pathKey: 'path',
    shaKey: 'sha256',
    kind: 'provider-batch-result',
    expectedJsonFields: typeof result['batchResultId'] === 'string' ? { batchResultId: result['batchResultId'] } : undefined,
    baseDir: ctx.renderDir,
    context: { renderDir: ctx.renderDir }
  })
}

const collectSlotReuse = (slot: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  const result = slot['batchResult']
  if (typeof slot['slotHash'] !== 'string' || !slot['slotHash'] || !isRecord(result)) return false
  return ctx.sink.addFile(result, {
    pathKey: 'path',
    shaKey: 'sha256',
    kind: 'provider-batch-result',
    expectedJsonFields: typeof result['batchResultId'] === 'string' ? { batchResultId: result['batchResultId'] } : undefined,
    baseDir: ctx.renderDir,
    context: { renderDir: ctx.renderDir }
  })
}

const collectGenerationSlots = (slots: readonly unknown[], ctx: RenderCollectorContext): boolean => {
  for (const slot of slots) {
    if (!isRecord(slot)) return false
    if (slot['source'] === 'provider-dispatch') {
      if (!collectProviderDispatch(slot, ctx)) return false
    } else if (slot['source'] === 'slot-reuse') {
      if (!collectSlotReuse(slot, ctx)) return false
    } else {
      return false
    }
  }
  return true
}

const BATCH_SELECTIONS = [
  { key: 'currentTakeSelection', kind: 'take-selection' },
  { key: 'continuationCheckpoint', kind: 'continuation-checkpoint' }
] as const satisfies readonly Readonly<{
  key: 'currentTakeSelection' | 'continuationCheckpoint'
  kind: ProjectionArtifactReference['kind']
}>[]

const collectBatchSelections = (batch: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  for (const descriptor of BATCH_SELECTIONS) {
    const selection = batch[descriptor.key]
    if (selection === undefined) continue
    if (!isRecord(selection)) return false
    if (!ctx.sink.addFile(selection, {
      pathKey: 'path',
      shaKey: 'sha256',
      kind: descriptor.kind,
      baseDir: ctx.renderDir,
      context: { renderDir: ctx.renderDir }
    })) return false
  }
  return true
}

export const collectBatchProgress = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  const progress = event['batchProgress']
  if (progress === undefined) return true
  if (!Array.isArray(progress)) return false
  for (const batch of progress) {
    if (!isRecord(batch) || !Array.isArray(batch['generationSlots'])) return false
    if (!collectGenerationSlots(batch['generationSlots'], ctx)) return false
    if (!collectBatchSelections(batch, ctx)) return false
  }
  return true
}
