import type { EventReferenceListDescriptor, RenderCollectorContext } from '~/types'
import { isRecord } from '~/utils/rest-client'

export const collectProviderRenderResult = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  if (event['providerRenderResultRef'] === undefined) return true
  if (typeof event['providerRenderResultIdentity'] !== 'string') return false
  return ctx.sink.addFile(event, {
    pathKey: 'providerRenderResultRef',
    shaKey: 'providerRenderResultSha256',
    kind: 'provider-render-result',
    expectedJsonFields: {
      resultIdentity: event['providerRenderResultIdentity'],
      renderPlanId: ctx.renderPlanId,
      renderIdentity: ctx.renderIdentity
    },
    context: {
      renderDir: ctx.renderDir,
      eventSequence: event['sequence'] as number,
      eventJournalSnapshotId: event['admissionJournalSnapshotId'] as string | undefined
    }
  })
}

export const collectAudioRun = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  if (event['audioRunRef'] === undefined) return true
  if (typeof event['audioRunId'] !== 'string') return false
  return ctx.sink.addFile(event, {
    pathKey: 'audioRunRef',
    shaKey: 'audioRunSha256',
    kind: 'audio-run',
    expectedJsonFields: {
      audioRunId: event['audioRunId'],
      targetKey: ctx.targetKey,
      renderPlanId: ctx.renderPlanId,
      renderIdentity: ctx.renderIdentity
    },
    context: {
      renderDir: ctx.renderDir,
      eventSequence: event['sequence'] as number,
      eventJournalSnapshotId: event['admissionJournalSnapshotId'] as string | undefined,
      eventResultIdentity: event['providerRenderResultIdentity'] as string | undefined
    }
  })
}

const EVENT_REFERENCE_LISTS: readonly EventReferenceListDescriptor[] = [
  { key: 'outputRefs', kind: 'audio', renderRelative: false, includeRenderContext: true },
  { key: 'takeSelections', kind: 'take-selection', renderRelative: true, includeRenderContext: true },
  { key: 'continuationCheckpoints', kind: 'continuation-checkpoint', renderRelative: true, includeRenderContext: true },
  { key: 'cacheEvidenceRefs', kind: 'generic-json', renderRelative: true, includeRenderContext: true },
  { key: 'reportedOutputRefs', kind: 'audio', renderRelative: false, includeRenderContext: false, scope: 'run-root' }
]

export const collectGenericEventLists = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  for (const descriptor of EVENT_REFERENCE_LISTS) {
    if (descriptor.key === 'reportedOutputRefs' && !ctx.verifyReportedOutputs) continue
    const list = event[descriptor.key]
    if (list === undefined) continue
    if (!Array.isArray(list)) return false
    for (const entry of list) {
      if (!isRecord(entry)) return false
      if (!ctx.sink.addFile(entry, {
        pathKey: 'path',
        shaKey: 'sha256',
        kind: descriptor.kind,
        baseDir: descriptor.renderRelative ? ctx.renderDir : undefined,
        context: descriptor.includeRenderContext ? { renderDir: ctx.renderDir } : undefined,
        scope: descriptor.scope
      })) return false
    }
  }
  return true
}

export const collectConsumedSelectionRebuild = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  const rebuild = event['consumedSelectionRebuild']
  if (rebuild === undefined) return true
  if (!isRecord(rebuild)) return false
  return ctx.sink.addFile(rebuild, {
    pathKey: 'path',
    shaKey: 'sha256',
    kind: 'consumed-selection-rebuild',
    expectedJsonFields: typeof rebuild['authorizationId'] === 'string' ? { authorizationId: rebuild['authorizationId'] } : undefined,
    baseDir: ctx.renderDir,
    context: { renderDir: ctx.renderDir }
  })
}
