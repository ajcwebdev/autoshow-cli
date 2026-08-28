import { posix } from 'node:path'
import type { NestedCollector, ProjectionArtifactReference } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { isOpaqueProtectedAssetRef, isSha256 } from './guards'
import { resolveArtifactRelativePath } from './projection-artifact-reference-sink'

const collectAdmissionJournalNested: NestedCollector = (ctx) => {
  const { reference, value, renderDir, add } = ctx
  const attemptDir = posix.dirname(reference.path)
  if (attemptDir === '.' || !renderDir || !Array.isArray(value['requests']) || !Array.isArray(value['recordedBatchResults'])) return false
  const context = { renderDir, attemptDir }
  for (const rawRequest of value['requests']) {
    if (!isRecord(rawRequest) || !add(rawRequest, 'batchInvocationPlanRef', 'batchInvocationPlanSha256', 'batch-invocation-plan', attemptDir, {
      batchInvocationPlanId: rawRequest['batchInvocationPlanId'] as string,
      renderPlanId: value['renderPlanId'] as string,
      renderIdentity: value['renderIdentity'] as string,
      invocationId: value['invocationId'] as string,
      batchId: rawRequest['batchId'] as string,
      generationSlotId: rawRequest['generationSlotId'] as string
    }, context)) return false
    if (!Array.isArray(rawRequest['transitions'])) return false
    for (const rawTransition of rawRequest['transitions']) {
      if (!isRecord(rawTransition)) return false
      const proof = rawTransition['evidence']
      if (proof === undefined) continue
      if (!isRecord(proof)) return false
      if (proof['kind'] === 'protected-asset') {
        if (!isOpaqueProtectedAssetRef(proof['asset'])) return false
      } else if (proof['kind'] !== 'sanitized-artifact' || !add(proof, 'path', 'sha256', 'admission-evidence', attemptDir, {
        journalId: value['journalId'] as string,
        invocationId: value['invocationId'] as string,
        requestOrdinal: rawRequest['requestOrdinal'] as number,
        requestFingerprint: rawRequest['requestFingerprint'] as string,
        evidenceKind: proof['proofKind'] as string
      }, context)) return false
    }
  }
  for (const rawResult of value['recordedBatchResults']) {
    if (!isRecord(rawResult) || !add(rawResult, 'batchResultRef', 'batchResultSha256', 'provider-batch-result', attemptDir, {
      batchResultId: rawResult['batchResultId'] as string,
      renderPlanId: value['renderPlanId'] as string,
      renderIdentity: value['renderIdentity'] as string,
      batchId: rawResult['batchId'] as string,
      generationSlotId: rawResult['generationSlotId'] as string
    }, context)) return false
  }
  const recordedResult = value['recordedResult']
  if (recordedResult !== undefined && (!isRecord(recordedResult) || !add(recordedResult, 'resultRef', 'resultSha256', 'provider-render-result', attemptDir, {
    resultIdentity: recordedResult['resultIdentity'] as string,
    renderPlanId: value['renderPlanId'] as string,
    renderIdentity: value['renderIdentity'] as string
  }, { ...context, eventJournalSnapshotId: value['snapshotId'] as string }))) return false
  const rebuild = value['consumedSelectionRebuild']
  if (rebuild !== undefined && (!isRecord(rebuild) || !add(rebuild, 'artifactRef', 'sha256', 'consumed-selection-rebuild', renderDir, {
    authorizationId: rebuild['authorizationId'] as string
  }, context))) return false
  return true
}

const collectProviderRenderResultNested: NestedCollector = (ctx) => {
  const { value, renderDir, add } = ctx
  if (!renderDir || !Array.isArray(value['batchResults'])) return false
  for (const rawResult of value['batchResults']) {
    if (!isRecord(rawResult) || !add(rawResult, 'artifactRef', 'sha256', 'provider-batch-result', renderDir, {
      batchResultId: rawResult['batchResultId'] as string,
      renderPlanId: value['renderPlanId'] as string,
      renderIdentity: value['renderIdentity'] as string,
      batchId: rawResult['batchId'] as string,
      generationSlotId: rawResult['generationSlotId'] as string
    }, { renderDir })) return false
  }
  const renderTakes = value['renderTakesArtifact']
  return renderTakes === undefined || (isRecord(renderTakes) && add(renderTakes, 'artifactRef', 'sha256', 'render-takes', renderDir, {
    renderTakesId: renderTakes['renderTakesId'] as string,
    renderPlanId: value['renderPlanId'] as string,
    renderIdentity: value['renderIdentity'] as string
  }, { renderDir }))
}

const collectProviderBatchResultNested: NestedCollector = (ctx) => {
  const { reference, value, renderDir, add } = ctx
  const markerIndex = reference.path.indexOf('/batch-results/')
  const attemptDir = reference.context?.attemptDir ?? (markerIndex > 0 ? reference.path.slice(0, markerIndex) : undefined)
  const batchResultDir = posix.dirname(reference.path)
  if (!renderDir || batchResultDir === '.' || !Array.isArray(value['outputs'])) return false
  const context = { renderDir, ...(attemptDir ? { attemptDir } : {}), batchResultDir }
  if (value['provenance'] === 'provider-dispatch') {
    const invocation = value['batchInvocationPlan']
    const admission = value['admissionBasis']
    if (
      !attemptDir || !isRecord(invocation)
      || !add(invocation, 'artifactRef', 'sha256', 'batch-invocation-plan', attemptDir, {
        batchInvocationPlanId: invocation['batchInvocationPlanId'] as string,
        renderPlanId: value['renderPlanId'] as string,
        renderIdentity: value['renderIdentity'] as string,
        invocationId: value['invocationId'] as string,
        batchId: value['batchId'] as string,
        generationSlotId: value['generationSlotId'] as string
      }, context)
      || !isRecord(admission)
      || !add(admission, 'artifactRef', 'sha256', 'admission-journal', attemptDir, {
        journalId: admission['journalId'] as string,
        snapshotId: admission['snapshotId'] as string,
        renderPlanId: value['renderPlanId'] as string,
        renderIdentity: value['renderIdentity'] as string
      }, context)
    ) return false
  }
  for (const rawOutput of value['outputs']) {
    if (!isRecord(rawOutput)) return false
    if (value['provenance'] === 'slot-reuse') {
      const path = resolveArtifactRelativePath(undefined, rawOutput['artifactRef'])
      if (!path || !isSha256(rawOutput['sha256'])) return false
      ctx.nested.push({ path, sha256: rawOutput['sha256'] as string, kind: 'audio', scope: 'run-root' })
    } else if (!add(rawOutput, 'artifactRef', 'sha256', 'audio', batchResultDir, undefined, context)) return false
  }
  const generated = value['generatedBatch']
  if (generated !== undefined) {
    if (!isRecord(generated) || !Array.isArray(generated['takes'])) return false
    for (const rawTake of generated['takes']) {
      if (!isRecord(rawTake) || !isRecord(rawTake['audio']) || !add(rawTake['audio'], 'artifactRef', 'sha256', 'audio', batchResultDir, undefined, context)) return false
      const timing = rawTake['rawProviderTimingEvidenceRef']
      if (timing !== undefined && (!isRecord(timing) || !add(timing, 'path', 'sha256', 'provider-timing-evidence', batchResultDir, {
        timingEvidenceId: timing['timingEvidenceId'] as string
      }, context))) return false
      const continuation = rawTake['continuationCandidate']
      if (isRecord(continuation) && continuation['kind'] === 'protected-token' && !isOpaqueProtectedAssetRef(continuation['asset'])) return false
    }
  }
  if (value['cacheMaterialization'] !== undefined || value['provenance'] === 'cache-materialization') return false
  return value['provenance'] !== 'slot-reuse' || typeof value['slotHash'] === 'string'
}

const collectBatchInvocationPlanNested: NestedCollector = (ctx) => {
  const { value, renderDir, add } = ctx
  const continuation = value['resolvedContinuation']
  if (!isRecord(continuation)) return false
  if (continuation['kind'] === 'checkpoint') {
    if (continuation['source'] !== 'prior-batch' || !renderDir || !add(continuation, 'checkpointRef', 'checkpointSha256', 'continuation-checkpoint', renderDir, {
      checkpointId: continuation['checkpointId'] as string
    }, { renderDir })) return false
    if (isRecord(continuation['continuationState']) && continuation['continuationState']['kind'] === 'protected-token' && !isOpaqueProtectedAssetRef(continuation['continuationState']['asset'])) return false
  } else if (continuation['kind'] !== 'none') return false
  return true
}

export const ADMISSION_NESTED_COLLECTORS: Partial<Record<ProjectionArtifactReference['kind'], NestedCollector>> = {
  'admission-journal': collectAdmissionJournalNested,
  'provider-render-result': collectProviderRenderResultNested,
  'provider-batch-result': collectProviderBatchResultNested,
  'batch-invocation-plan': collectBatchInvocationPlanNested
}
