import { posix } from 'node:path'
import type { RenderAdmissionJournalSnapshot } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { hashCanonicalTtsValue } from '../step-4-tts/script-to-audio/contract-identity'
import { validateRenderAdmissionJournalSnapshot } from '../step-4-tts/script-to-audio/contract-validation'
import { canonicalManifestJson } from './guards'
import type { GraphLinkContext } from './projection-artifact-link-context'

export const validateAdmissionJournalLinks = (ctx: GraphLinkContext): boolean => {
  const attemptDirectories = new Map<string, string>()
  for (const reference of ctx.referencesForKind('admission-journal')) {
    const value = ctx.jsonAt(reference)
    const snapshotId = value?.['snapshotId']
    if (!value || typeof snapshotId !== 'string') return false
    const attemptDir = posix.dirname(reference.path)
    const attemptIdentity = canonicalManifestJson({
      journalId: value['journalId'],
      invocationId: value['invocationId'],
      attempt: value['attempt'],
      renderIdentity: value['renderIdentity']
    })
    const priorAttemptIdentity = attemptDirectories.get(attemptDir)
    if (priorAttemptIdentity !== undefined && priorAttemptIdentity !== attemptIdentity) return false
    attemptDirectories.set(attemptDir, attemptIdentity)
    const prior = ctx.admissionSnapshots.get(snapshotId)
    if (prior && (prior.reference.path !== reference.path || prior.reference.sha256 !== reference.sha256)) return false
    ctx.admissionSnapshots.set(snapshotId, { reference, value })
  }
  const journalRoots = new Map<string, number>()
  const journalIds = new Set<string>()
  for (const { value } of ctx.admissionSnapshots.values()) {
    if (typeof value['journalId'] !== 'string') return false
    journalIds.add(value['journalId'])
    const previousSnapshotId = value['previousSnapshotId']
    if (previousSnapshotId === undefined) {
      const journalId = value['journalId'] as string
      if (
        !Array.isArray(value['requests'])
        || value['requests'].length !== 0
        || !Array.isArray(value['recordedBatchResults'])
        || value['recordedBatchResults'].length !== 0
        || value['recordedResult'] !== undefined
      ) return false
      journalRoots.set(journalId, (journalRoots.get(journalId) ?? 0) + 1)
    } else {
      const previous = typeof previousSnapshotId === 'string' ? ctx.admissionSnapshots.get(previousSnapshotId)?.value : undefined
      if (!previous) return false
      validateRenderAdmissionJournalSnapshot(
        value as unknown as RenderAdmissionJournalSnapshot,
        previous as unknown as RenderAdmissionJournalSnapshot
      )
    }
  }
  if ([...journalIds].some((journalId) => journalRoots.get(journalId) !== 1)) return false
  for (const snapshot of ctx.admissionSnapshots.values()) {
    const seen = new Set<string>()
    let current: Record<string, unknown> | undefined = snapshot.value
    while (current) {
      const snapshotId = current['snapshotId']
      if (typeof snapshotId !== 'string' || seen.has(snapshotId) || current['journalId'] !== snapshot.value['journalId']) return false
      seen.add(snapshotId)
      const previousSnapshotId: unknown = current['previousSnapshotId']
      current = previousSnapshotId === undefined
        ? undefined
        : typeof previousSnapshotId === 'string'
          ? ctx.admissionSnapshots.get(previousSnapshotId)?.value
          : undefined
      if (previousSnapshotId !== undefined && !current) return false
    }
  }
  return true
}

export const validateRenderResultClosedByLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('provider-render-result')) {
    const value = ctx.jsonAt(reference)
    const closedBy = value?.['closedBy']
    if (!value || !isRecord(closedBy)) return false
    if (closedBy['kind'] === 'provider-attempt') {
      const terminalSnapshotIds = new Set(ctx.referencesForKind('provider-render-result').flatMap((candidate) =>
        candidate.path === reference.path
        && candidate.sha256 === reference.sha256
        && candidate.context?.eventJournalSnapshotId
          ? [candidate.context.eventJournalSnapshotId]
          : []
      ))
      if (terminalSnapshotIds.size !== 1) return false
      const terminalSnapshotId = [...terminalSnapshotIds][0]
      const terminal = terminalSnapshotId ? ctx.admissionSnapshots.get(terminalSnapshotId) : undefined
      const recorded = terminal?.value['recordedResult']
      const attemptDir = terminal ? posix.dirname(terminal.reference.path) : undefined
      const recordedPath = isRecord(recorded) ? ctx.resolveFrom(attemptDir, recorded['resultRef']) : undefined
      if (
        !terminal
        || !isRecord(recorded)
        || recorded['resultIdentity'] !== value['resultIdentity']
        || recordedPath !== reference.path
        || recorded['resultSha256'] !== reference.sha256
        || recorded['batchResultSetHash'] !== hashCanonicalTtsValue(value['batchResults'])
        || closedBy['invocationId'] !== terminal.value['invocationId']
        || closedBy['attempt'] !== terminal.value['attempt']
      ) return false
    } else {
      if (closedBy['kind'] !== 'local-composition' || reference.context?.eventJournalSnapshotId !== undefined) return false
      const expectedCompositionId = hashCanonicalTtsValue({
        renderPlanId: value['renderPlanId'],
        renderIdentity: value['renderIdentity'],
        batchResults: value['batchResults']
      })
      if (closedBy['compositionId'] !== expectedCompositionId) return false
    }
  }
  return true
}

export const validateBatchResultProvenanceLinks = (ctx: GraphLinkContext): boolean => {
  for (const batch of ctx.batchResults.values()) {
    const value = batch.value
    if (value['provenance'] !== 'provider-dispatch') continue
    const attemptDir = batch.reference.context?.attemptDir
      ?? (batch.reference.path.includes('/batch-results/') ? batch.reference.path.slice(0, batch.reference.path.indexOf('/batch-results/')) : undefined)
    const invocationRef = value['batchInvocationPlan']
    const admissionBasis = value['admissionBasis']
    if (!attemptDir || !isRecord(invocationRef) || !isRecord(admissionBasis)) return false
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
    ) return false
    const journalRequests = basis.value['requests'].filter((request) =>
      isRecord(request)
      && request['batchId'] === value['batchId']
      && request['generationSlotId'] === value['generationSlotId']
    )
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
      const terminalState = journalRequest['transitions'].at(-1)
      if (
        value['status'] === 'succeeded'
        && (!isRecord(terminalState) || terminalState['state'] !== 'completed')
      ) return false
    }
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
  }
  return true
}

export const validateJournalRecordedBatchLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('admission-journal')) {
    const value = ctx.jsonAt(reference)
    if (!value) return false
    if (!Array.isArray(value['recordedBatchResults'])) return false
    const attemptDir = posix.dirname(reference.path)
    for (const rawRecordedBatch of value['recordedBatchResults']) {
      if (!isRecord(rawRecordedBatch) || typeof rawRecordedBatch['batchResultId'] !== 'string') return false
      const batch = ctx.batchResults.get(rawRecordedBatch['batchResultId'])
      const batchPath = ctx.resolveFrom(attemptDir, rawRecordedBatch['batchResultRef'])
      const admissionBasis = batch?.value['admissionBasis']
      const basisSnapshotId = rawRecordedBatch['admissionBasisSnapshotId']
      const basis = typeof basisSnapshotId === 'string' ? ctx.admissionSnapshots.get(basisSnapshotId) : undefined
      const basisPath = isRecord(admissionBasis) ? ctx.resolveFrom(attemptDir, admissionBasis['artifactRef']) : undefined
      let ancestor: Record<string, unknown> | undefined = value
      let foundStrictAncestor = false
      while (ancestor && ancestor['previousSnapshotId'] !== undefined) {
        const previousId: unknown = ancestor['previousSnapshotId']
        ancestor = typeof previousId === 'string' ? ctx.admissionSnapshots.get(previousId)?.value : undefined
        if (ancestor?.['snapshotId'] === basisSnapshotId) {
          foundStrictAncestor = true
          break
        }
      }
      if (
        !batch
        || !batchPath
        || batch.reference.path !== batchPath
        || batch.reference.sha256 !== rawRecordedBatch['batchResultSha256']
        || batch.value['batchId'] !== rawRecordedBatch['batchId']
        || batch.value['generationSlotId'] !== rawRecordedBatch['generationSlotId']
        || !isRecord(admissionBasis)
        || admissionBasis['journalId'] !== value['journalId']
        || admissionBasis['snapshotId'] !== basisSnapshotId
        || !basis
        || !basisPath
        || basis.reference.path !== basisPath
        || basis.reference.sha256 !== admissionBasis['sha256']
        || !foundStrictAncestor
      ) return false
    }
    const recorded = value['recordedResult']
    if (recorded !== undefined) {
      if (!isRecord(recorded)) return false
      const resultPath = ctx.resolveFrom(attemptDir, recorded['resultRef'])
      const aggregate = resultPath ? ctx.checkedProviderPath(resultPath)?.json : undefined
      if (
        !aggregate
        || aggregate['resultIdentity'] !== recorded['resultIdentity']
        || ctx.checkedProviderPath(resultPath as string)?.sha256 !== recorded['resultSha256']
        || hashCanonicalTtsValue(aggregate['batchResults']) !== recorded['batchResultSetHash']
      ) return false
    }
  }
  return true
}

const validateSourceBinding = (
  ctx: GraphLinkContext,
  source: Record<string, unknown>,
  resultIdentity: string
): boolean => {
  if (source['kind'] === 'provider-output') {
    const resolved = ctx.batchOutput(source['batchResultId'], source['outputId'])
    return Boolean(
      resolved
      && source['resultIdentity'] === resultIdentity
      && source['artifactRef'] === resolved.output['artifactRef']
      && source['sha256'] === resolved.output['sha256']
    )
  }
  if (source['kind'] === 'take') {
    if (typeof source['batchResultId'] !== 'string' || typeof source['takeId'] !== 'string') return false
    const batch = ctx.batchResults.get(source['batchResultId'])
    const generated = batch?.value['generatedBatch']
    if (!isRecord(generated) || !Array.isArray(generated['takes'])) return false
    const takes = generated['takes'].filter((take) => isRecord(take) && take['takeId'] === source['takeId'])
    const audio = isRecord(takes[0]) ? takes[0]['audio'] : undefined
    return Boolean(
      takes.length === 1
      && isRecord(audio)
      && source['resultIdentity'] === resultIdentity
      && source['artifactRef'] === audio['artifactRef']
      && source['sha256'] === audio['sha256']
    )
  }
  return false
}

export const validateAudioRunLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('audio-run')) {
    const value = ctx.jsonAt(reference)
    const renderDir = reference.context?.renderDir
    const audioRunDir = posix.dirname(reference.path)
    const providerResult = value?.['providerResult']
    if (!value || !renderDir || audioRunDir === '.' || !isRecord(providerResult) || typeof providerResult['resultIdentity'] !== 'string') return false
    const providerResultPath = ctx.resolveFrom(renderDir, providerResult['path'])
    const aggregate = providerResultPath ? ctx.checkedProviderPath(providerResultPath)?.json : undefined
    if (
      !aggregate
      || aggregate['resultIdentity'] !== providerResult['resultIdentity']
      || ctx.checkedProviderPath(providerResultPath as string)?.sha256 !== providerResult['sha256']
      || aggregate['renderPlanId'] !== value['renderPlanId']
      || aggregate['renderIdentity'] !== value['renderIdentity']
    ) return false
    for (const role of ['mixPlan', 'transformLedger', 'finalTimeline'] as const) {
      const child = value[role]
      if (!isRecord(child)) return false
      const childPath = ctx.resolveFrom(audioRunDir, child['path'])
      if (!childPath || ctx.checkedProviderPath(childPath)?.sha256 !== child['sha256']) return false
    }
    const mix = isRecord(value['mixPlan']) ? ctx.checkedProviderPath(ctx.resolveFrom(audioRunDir, value['mixPlan']['path']) as string)?.json : undefined
    const timeline = isRecord(value['finalTimeline']) ? ctx.checkedProviderPath(ctx.resolveFrom(audioRunDir, value['finalTimeline']['path']) as string)?.json : undefined
    for (const artifact of [mix, timeline]) {
      const sources = artifact?.[artifact === mix ? 'sources' : 'speechSources']
      if (!Array.isArray(sources) || sources.some((source) => !isRecord(source) || !validateSourceBinding(ctx, source, providerResult['resultIdentity'] as string))) return false
    }
  }
  return true
}
