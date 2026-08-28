import type { RenderCollectorContext } from '~/types'
import { isRecord } from '~/utils/rest-client'

export const collectAdmissionJournal = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  if (event['admissionJournalRef'] === undefined) return true
  if (typeof event['admissionJournalSnapshotId'] !== 'string') return false
  return ctx.sink.addFile(event, {
    pathKey: 'admissionJournalRef',
    shaKey: 'admissionJournalSha256',
    kind: 'admission-journal',
    expectedJsonFields: {
      snapshotId: event['admissionJournalSnapshotId'],
      renderPlanId: ctx.renderPlanId,
      renderIdentity: ctx.renderIdentity
    },
    context: {
      renderDir: ctx.renderDir,
      eventSequence: event['sequence'] as number,
      eventResultIdentity: event['providerRenderResultIdentity'] as string | undefined
    }
  })
}

export const collectReadinessAuthorization = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  const authorization = event['readinessAuthorization']
  if (authorization === undefined) return true
  if (!isRecord(authorization)) return false
  if (!ctx.sink.addFile(authorization, {
    pathKey: 'readinessResultRef',
    shaKey: 'readinessResultHash',
    kind: 'readiness-result',
    expectedJsonFields: { branchPlanId: authorization['branchPlanId'] as string, targetKey: ctx.targetKey },
    context: {
      renderDir: ctx.renderDir,
      branchCandidateId: authorization['branchCandidateId'] as string,
      accountObservationHashes: authorization['accountObservationHashes'] as string[]
    }
  })) return false
  return ctx.sink.addFile(ctx.render, {
    pathKey: 'renderPlanRef',
    shaKey: 'renderPlanSha256',
    kind: 'render-plan',
    expectedJsonFields: {
      renderPlanId: ctx.renderPlanId,
      renderIdentity: ctx.renderIdentity,
      targetKey: ctx.targetKey,
      branchPlanId: authorization['branchPlanId'] as string,
      branchCandidateId: authorization['branchCandidateId'] as string
    },
    context: { renderDir: ctx.renderDir }
  })
}
