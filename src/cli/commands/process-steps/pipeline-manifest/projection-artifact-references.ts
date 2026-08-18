import { posix } from 'node:path'
import { createHash } from 'node:crypto'
import { isRecord } from '~/utils/rest-client'
import { isOpaqueProtectedAssetRef, isSha256, isStrictArtifactRelativePath } from './guards'

export type ProjectionArtifactReference = {
  path: string
  sha256: string
  scope?: 'provider-artifact' | 'run-root' | undefined
  kind: 'audio' | 'strategy-text' | 'source-identity' | 'dialogue-plan' | 'capability-fixture' | 'branch-plan' | 'readiness-result' | 'render-plan' | 'admission-journal' | 'admission-evidence' | 'provider-render-result' | 'audio-run' | 'audio-mix-plan' | 'audio-transform-ledger' | 'final-timeline' | 'batch-invocation-plan' | 'provider-batch-result' | 'provider-timing-evidence' | 'cache-materialization-plan' | 'render-takes' | 'take-selection' | 'continuation-checkpoint' | 'consumed-selection-rebuild' | 'generic-json' | 'compact-render'
  expectedJsonFields?: Record<string, string | number> | undefined
  context?: {
    renderDir?: string | undefined
    attemptDir?: string | undefined
    batchResultDir?: string | undefined
    audioRunDir?: string | undefined
    branchCandidateId?: string | undefined
    accountObservationHashes?: string[] | undefined
    eventSequence?: number | undefined
    eventJournalSnapshotId?: string | undefined
    eventResultIdentity?: string | undefined
  } | undefined
}

export type ProjectionArtifactReferences = {
  files: ProjectionArtifactReference[]
  directories: string[]
}

export const resolveArtifactRelativePath = (
  baseDir: string | undefined,
  value: unknown
): string | undefined => {
  if (!isStrictArtifactRelativePath(value)) return undefined
  if (!baseDir) return value
  if (!isStrictArtifactRelativePath(baseDir)) return undefined
  const combined = posix.join(baseDir, value)
  return isStrictArtifactRelativePath(combined) ? combined : undefined
}

export const projectionArtifactReferenceKey = (reference: Pick<ProjectionArtifactReference, 'path' | 'scope'>): string =>
  `${reference.scope ?? 'provider-artifact'}\0${reference.path}`

export const createNestedArtifactReference = (
  record: Record<string, unknown>,
  pathKey: string,
  shaKey: string,
  kind: ProjectionArtifactReference['kind'],
  baseDir: string | undefined,
  expectedJsonFields?: Record<string, string | number> | undefined,
  context?: ProjectionArtifactReference['context']
): ProjectionArtifactReference | undefined => {
  const path = resolveArtifactRelativePath(baseDir, record[pathKey])
  const sha256 = record[shaKey]
  if (!path || !isSha256(sha256)) return undefined
  return { path, sha256, kind, ...(expectedJsonFields ? { expectedJsonFields } : {}), ...(context ? { context } : {}) }
}

export const collectProjectionArtifactReferences = (
  projection: Record<string, unknown>,
  targetKey: string
): ProjectionArtifactReferences | undefined => {
  const files: ProjectionArtifactReferences['files'] = []
  const directories: string[] = []
  const addFile = (
    record: Record<string, unknown>,
    pathKey: string,
    shaKey: string,
    kind: ProjectionArtifactReference['kind'],
    expectedJsonFields?: Record<string, string | number> | undefined,
    baseDir?: string | undefined,
    context?: ProjectionArtifactReference['context'],
    scope: ProjectionArtifactReference['scope'] = 'provider-artifact'
  ): boolean => {
    const path = resolveArtifactRelativePath(baseDir, record[pathKey])
    const sha256 = record[shaKey]
    if (!path || !isSha256(sha256)) return false
    files.push({ path, sha256, scope, kind, ...(expectedJsonFields ? { expectedJsonFields } : {}), ...(context ? { context } : {}) })
    return true
  }

  const archive = projection['archive']
  if (isRecord(archive) && isRecord(projection['selectedSuccess']) && projection['activeWork'] === undefined) {
    if (
      !isRecord(archive['renderRef'])
      || !addFile(archive['renderRef'], 'path', 'sha256', 'compact-render', { targetKey }, undefined, undefined, 'run-root')
      || !isRecord(archive['timelineRef'])
      || !addFile(archive['timelineRef'], 'path', 'sha256', 'final-timeline', undefined, undefined, undefined, 'run-root')
      || !isRecord(archive['finalRef'])
      || !addFile(archive['finalRef'], 'path', 'sha256', 'audio', undefined, undefined, undefined, 'run-root')
    ) return undefined
    return { files, directories }
  }

  for (const branch of projection['branchHistory'] as unknown[]) {
    if (
      !isRecord(branch)
      || typeof branch['branchPlanId'] !== 'string'
      || !addFile(branch, 'branchPlanRef', 'branchPlanSha256', 'branch-plan', { branchPlanId: branch['branchPlanId'], targetKey })
    ) return undefined
  }
  for (const readiness of projection['readinessAttempts'] as unknown[]) {
    if (!isRecord(readiness) || !addFile(readiness, 'readinessResultRef', 'readinessResultHash', 'readiness-result', {
      branchPlanId: readiness['branchPlanId'] as string,
      targetKey
    })) return undefined
  }
  for (const rawRender of projection['renderHistory'] as unknown[]) {
    if (
      !isRecord(rawRender)
      || typeof rawRender['renderPlanId'] !== 'string'
      || typeof rawRender['renderIdentity'] !== 'string'
      || !addFile(rawRender, 'renderPlanRef', 'renderPlanSha256', 'render-plan', {
        renderPlanId: rawRender['renderPlanId'],
        renderIdentity: rawRender['renderIdentity'],
        targetKey
      }, undefined, { renderDir: rawRender['renderDir'] as string })
      || !isStrictArtifactRelativePath(rawRender['renderDir'])
    ) {
      return undefined
    }
    directories.push(rawRender['renderDir'])
    for (const rawEvent of rawRender['events'] as unknown[]) {
      if (!isRecord(rawEvent)) return undefined
      const event = rawEvent
      if (
        event['admissionJournalRef'] !== undefined
        && (
          typeof event['admissionJournalSnapshotId'] !== 'string'
          || !addFile(event, 'admissionJournalRef', 'admissionJournalSha256', 'admission-journal', {
            snapshotId: event['admissionJournalSnapshotId'],
            renderPlanId: rawRender['renderPlanId'] as string,
            renderIdentity: rawRender['renderIdentity'] as string
          }, undefined, {
            renderDir: rawRender['renderDir'] as string,
            eventSequence: event['sequence'] as number,
            eventResultIdentity: event['providerRenderResultIdentity'] as string | undefined
          })
        )
      ) return undefined
      if (
        event['providerRenderResultRef'] !== undefined
        && (
          typeof event['providerRenderResultIdentity'] !== 'string'
          || !addFile(event, 'providerRenderResultRef', 'providerRenderResultSha256', 'provider-render-result', {
            resultIdentity: event['providerRenderResultIdentity'],
            renderPlanId: rawRender['renderPlanId'] as string,
            renderIdentity: rawRender['renderIdentity'] as string
          }, undefined, {
            renderDir: rawRender['renderDir'] as string,
            eventSequence: event['sequence'] as number,
            eventJournalSnapshotId: event['admissionJournalSnapshotId'] as string | undefined
          })
        )
      ) return undefined
      if (
        event['audioRunRef'] !== undefined
        && (
          typeof event['audioRunId'] !== 'string'
          || !addFile(event, 'audioRunRef', 'audioRunSha256', 'audio-run', {
            audioRunId: event['audioRunId'],
            targetKey,
            renderPlanId: rawRender['renderPlanId'] as string,
            renderIdentity: rawRender['renderIdentity'] as string
          }, undefined, {
            renderDir: rawRender['renderDir'] as string,
            eventSequence: event['sequence'] as number,
            eventJournalSnapshotId: event['admissionJournalSnapshotId'] as string | undefined,
            eventResultIdentity: event['providerRenderResultIdentity'] as string | undefined
          })
        )
      ) return undefined
      const readinessAuthorization = event['readinessAuthorization']
      if (readinessAuthorization !== undefined) {
        if (!isRecord(readinessAuthorization) || !addFile(readinessAuthorization, 'readinessResultRef', 'readinessResultHash', 'readiness-result', {
          branchPlanId: readinessAuthorization['branchPlanId'] as string,
          targetKey
        }, undefined, {
          renderDir: rawRender['renderDir'] as string,
          branchCandidateId: readinessAuthorization['branchCandidateId'] as string,
          accountObservationHashes: readinessAuthorization['accountObservationHashes'] as string[]
        }) || !addFile(rawRender, 'renderPlanRef', 'renderPlanSha256', 'render-plan', {
          renderPlanId: rawRender['renderPlanId'] as string,
          renderIdentity: rawRender['renderIdentity'] as string,
          targetKey,
          branchPlanId: readinessAuthorization['branchPlanId'] as string,
          branchCandidateId: readinessAuthorization['branchCandidateId'] as string
        }, undefined, { renderDir: rawRender['renderDir'] as string })) return undefined
      }
      for (const listKey of ['outputRefs', 'takeSelections', 'continuationCheckpoints', 'cacheEvidenceRefs'] as const) {
        const list = event[listKey]
        if (list !== undefined) {
          if (!Array.isArray(list)) return undefined
          for (const entry of list) {
            const kind = listKey === 'outputRefs'
              ? 'audio'
              : listKey === 'takeSelections'
                ? 'take-selection'
                : listKey === 'continuationCheckpoints'
                  ? 'continuation-checkpoint'
                  : 'generic-json'
            if (
              !isRecord(entry)
              || !addFile(
                entry,
                'path',
                'sha256',
                kind,
                undefined,
                listKey === 'outputRefs' ? undefined : rawRender['renderDir'] as string,
                { renderDir: rawRender['renderDir'] as string }
              )
            ) return undefined
          }
        }
      }
      const reportedOutputRefs = event['reportedOutputRefs']
      if (reportedOutputRefs !== undefined) {
        if (!Array.isArray(reportedOutputRefs)) return undefined
        for (const entry of reportedOutputRefs) {
          if (!isRecord(entry) || !addFile(entry, 'path', 'sha256', 'audio', undefined, undefined, undefined, 'run-root')) return undefined
        }
      }
      const rebuild = event['consumedSelectionRebuild']
      if (rebuild !== undefined && (!isRecord(rebuild) || !addFile(
        rebuild,
        'path',
        'sha256',
        'consumed-selection-rebuild',
        typeof rebuild['authorizationId'] === 'string' ? { authorizationId: rebuild['authorizationId'] } : undefined,
        rawRender['renderDir'] as string,
        { renderDir: rawRender['renderDir'] as string }
      ))) return undefined
      const batchProgress = event['batchProgress']
      if (batchProgress !== undefined) {
        if (!Array.isArray(batchProgress)) return undefined
        for (const batch of batchProgress) {
          if (!isRecord(batch) || !Array.isArray(batch['generationSlots'])) return undefined
          for (const slot of batch['generationSlots']) {
            if (!isRecord(slot)) return undefined
            if (slot['source'] === 'provider-dispatch') {
              const plan = slot['batchInvocationPlan']
              const result = slot['batchResult']
              if (!isRecord(plan) || !addFile(
                plan,
                'path',
                'sha256',
                'batch-invocation-plan',
                typeof plan['batchInvocationPlanId'] === 'string' ? { batchInvocationPlanId: plan['batchInvocationPlanId'] } : undefined,
                rawRender['renderDir'] as string,
                { renderDir: rawRender['renderDir'] as string }
              )) return undefined
              if (result !== undefined && (!isRecord(result) || !addFile(
                result,
                'path',
                'sha256',
                'provider-batch-result',
                typeof result['batchResultId'] === 'string' ? { batchResultId: result['batchResultId'] } : undefined,
                rawRender['renderDir'] as string,
                { renderDir: rawRender['renderDir'] as string }
              ))) return undefined
            } else if (slot['source'] === 'slot-reuse') {
              const result = slot['batchResult']
              if (
                typeof slot['slotHash'] !== 'string'
                || !slot['slotHash']
                || !isRecord(result)
                || !addFile(result, 'path', 'sha256', 'provider-batch-result', undefined, undefined, { renderDir: rawRender['renderDir'] as string }, 'run-root')
              ) return undefined
            } else {
              return undefined
            }
          }
          for (const selectionKey of ['currentTakeSelection', 'continuationCheckpoint'] as const) {
            const selection = batch[selectionKey]
            if (selection !== undefined && (!isRecord(selection) || !addFile(
              selection,
              'path',
              'sha256',
              selectionKey === 'currentTakeSelection' ? 'take-selection' : 'continuation-checkpoint',
              undefined,
              rawRender['renderDir'] as string,
              { renderDir: rawRender['renderDir'] as string }
            ))) return undefined
          }
        }
      }
    }
  }
  return { files, directories }
}

export type NestedCollectorContext = {
  reference: ProjectionArtifactReference
  value: Record<string, unknown>
  renderDir: string | undefined
  nested: ProjectionArtifactReference[]
  add: (
    record: Record<string, unknown>,
    pathKey: string,
    shaKey: string,
    kind: ProjectionArtifactReference['kind'],
    baseDir: string | undefined,
    expectedJsonFields?: Record<string, string | number> | undefined,
    context?: ProjectionArtifactReference['context']
  ) => boolean
}

type NestedCollector = (ctx: NestedCollectorContext) => boolean

const collectCompactRenderNested: NestedCollector = (ctx) => {
  const slots = ctx.value['slots']
  if (!Array.isArray(slots)) return false
  for (const rawSlot of slots) {
    if (!isRecord(rawSlot) || typeof rawSlot['slotHash'] !== 'string' || !isSha256(rawSlot['sha256'])) return false
    const slotDir = posix.dirname(ctx.reference.path)
    const mediaRoot = slotDir.includes('/') ? posix.dirname(slotDir) : ''
    const slotPath = mediaRoot ? `${mediaRoot}/slots/${rawSlot['slotHash']}.wav` : `slots/${rawSlot['slotHash']}.wav`
    ctx.nested.push({ path: slotPath, sha256: rawSlot['sha256'] as string, kind: 'audio', scope: 'run-root' })
  }
  return true
}

const collectReadinessResultNested: NestedCollector = (ctx) => {
  const fixture = ctx.value['capabilityFixture']
  if (
    !isRecord(fixture)
    || !ctx.add(fixture, 'path', 'sha256', 'capability-fixture', undefined, {
      capabilityFixtureHash: fixture['capabilityFixtureHash'] as string
    })
  ) return false
  return true
}

const collectRenderPlanNested: NestedCollector = (ctx) => {
  const { reference, value, renderDir, add } = ctx
  const repair = value['repair']
  const branchHasRepair = reference.kind === 'branch-plan'
    && Array.isArray(value['candidateStrategies'])
    && value['candidateStrategies'].some((candidate) => isRecord(candidate) && candidate['repair'] !== undefined)
  const hasExternalContinuation = reference.kind === 'render-plan'
    && Array.isArray(value['batches'])
    && value['batches'].some((batch) =>
      isRecord(batch)
      && isRecord(batch['continuation'])
      && batch['continuation']['kind'] === 'external-checkpoint'
    )
  if (repair !== undefined || branchHasRepair || hasExternalContinuation) {
    return false
  }
  if (reference.kind === 'render-plan') {
    const strategy = value['strategyArtifacts']
    if (
      !renderDir
      || !isRecord(strategy)
      || !isRecord(strategy['sourceIdentity'])
      || !isRecord(strategy['dialoguePlan'])
      || !isRecord(strategy['normalizedDialogue'])
      || strategy['sourceIdentity']['identityHash'] !== value['sourceIdentityHash']
      || strategy['dialoguePlan']['dialoguePlanId'] !== value['dialoguePlanId']
      || !Array.isArray(strategy['turns'])
      || !Array.isArray(strategy['generationSlots'])
    ) return false
    const plannedTurns = Array.isArray(value['nodes'])
      ? value['nodes'].flatMap((node) => {
          if (!isRecord(node)) return []
          if (node['kind'] === 'turn' && isRecord(node['turn'])) return [node['turn']]
          if (node['kind'] === 'overlap' && Array.isArray(node['turns'])) return node['turns'].filter(isRecord)
          return []
        })
      : []
    const plannedSlots = Array.isArray(value['batches'])
      ? value['batches'].flatMap((batch) => isRecord(batch) && Array.isArray(batch['generationSlots']) ? batch['generationSlots'].filter(isRecord) : [])
      : []
    const turnArtifacts = strategy['turns']
    const slotArtifacts = strategy['generationSlots']
    if (
      turnArtifacts.length !== plannedTurns.length
      || slotArtifacts.length !== plannedSlots.length
      || turnArtifacts.some((artifact, index) => !isRecord(artifact) || artifact['turnId'] !== plannedTurns[index]?.['turnId'])
      || slotArtifacts.some((artifact, index) => !isRecord(artifact) || artifact['generationSlotId'] !== plannedSlots[index]?.['generationSlotId'])
    ) return false
    const allArtifacts = [strategy['sourceIdentity'], strategy['dialoguePlan'], strategy['normalizedDialogue'], ...turnArtifacts, ...slotArtifacts]
    const artifactPaths = allArtifacts.flatMap((artifact) => isRecord(artifact) && typeof artifact['path'] === 'string' ? [artifact['path']] : [])
    if (artifactPaths.length !== allArtifacts.length || new Set(artifactPaths).size !== artifactPaths.length) return false
    if (!add(strategy['sourceIdentity'], 'path', 'sha256', 'source-identity', renderDir, { identityHash: value['sourceIdentityHash'] as string }, { renderDir })) return false
    if (!add(strategy['dialoguePlan'], 'path', 'sha256', 'dialogue-plan', renderDir, { dialoguePlanId: value['dialoguePlanId'] as string }, { renderDir })) return false
    if (!add(strategy['normalizedDialogue'], 'path', 'sha256', 'strategy-text', renderDir, undefined, { renderDir })) return false
    for (const [index, rawArtifact] of turnArtifacts.entries()) {
      const plannedTurn = plannedTurns[index]
      if (!isRecord(rawArtifact) || !isRecord(plannedTurn) || typeof plannedTurn['canonicalText'] !== 'string') return false
      const expectedSha = createHash('sha256').update(plannedTurn['canonicalText'].endsWith('\n') ? plannedTurn['canonicalText'] : `${plannedTurn['canonicalText']}\n`).digest('hex')
      if (rawArtifact['sha256'] !== expectedSha || !add(rawArtifact, 'path', 'sha256', 'strategy-text', renderDir, undefined, { renderDir })) return false
    }
    for (const rawArtifact of slotArtifacts) {
      if (!isRecord(rawArtifact) || !add(rawArtifact, 'path', 'sha256', 'strategy-text', renderDir, undefined, { renderDir })) return false
    }
  }
  return true
}

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
        continue
      }
      if (proof['kind'] !== 'sanitized-artifact' || !add(proof, 'path', 'sha256', 'admission-evidence', attemptDir, {
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
  if (renderTakes !== undefined && (!isRecord(renderTakes) || !add(renderTakes, 'artifactRef', 'sha256', 'render-takes', renderDir, {
    renderTakesId: renderTakes['renderTakesId'] as string,
    renderPlanId: value['renderPlanId'] as string,
    renderIdentity: value['renderIdentity'] as string
  }, { renderDir }))) return false
  return true
}

const collectProviderBatchResultNested: NestedCollector = (ctx) => {
  const { reference, value, renderDir, add } = ctx
  const marker = '/batch-results/'
  const markerIndex = reference.path.indexOf(marker)
  const attemptDir = reference.context?.attemptDir ?? (markerIndex > 0 ? reference.path.slice(0, markerIndex) : undefined)
  const batchResultDir = posix.dirname(reference.path)
  if (!renderDir || batchResultDir === '.' || !Array.isArray(value['outputs'])) return false
  const context = { renderDir, ...(attemptDir ? { attemptDir } : {}), batchResultDir }
  if (value['provenance'] === 'provider-dispatch') {
    const invocation = value['batchInvocationPlan']
    const admission = value['admissionBasis']
    if (
      !attemptDir
      || !isRecord(invocation)
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
      continue
    }
    if (!add(rawOutput, 'artifactRef', 'sha256', 'audio', batchResultDir, undefined, context)) return false
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
  if (value['provenance'] === 'slot-reuse' && typeof value['slotHash'] !== 'string') return false
  return true
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
  } else if (continuation['kind'] !== 'none') {
    return false
  }
  return true
}

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
  if (!isRecord(ledger) || !ctx.add(ledger, 'path', 'sha256', 'audio-transform-ledger', audioRunDir, {
    renderIdentity: ctx.value['renderIdentity'] as string
  }, ctx.reference.context)) return false
  return true
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
  if (isRecord(state) && state['kind'] === 'protected-token' && !isOpaqueProtectedAssetRef(state['asset'])) return false
  return true
}

const NESTED_COLLECTORS: Partial<Record<ProjectionArtifactReference['kind'], NestedCollector>> = {
  'compact-render': collectCompactRenderNested,
  'readiness-result': collectReadinessResultNested,
  'render-plan': collectRenderPlanNested,
  'branch-plan': collectRenderPlanNested,
  'admission-journal': collectAdmissionJournalNested,
  'provider-render-result': collectProviderRenderResultNested,
  'provider-batch-result': collectProviderBatchResultNested,
  'batch-invocation-plan': collectBatchInvocationPlanNested,
  'audio-run': collectAudioRunNested,
  'final-timeline': collectFinalTimelineNested,
  'render-takes': collectRenderTakesNested,
  'take-selection': collectTakeSelectionNested,
  'continuation-checkpoint': collectContinuationCheckpointNested
}

export const collectNestedProjectionArtifactReferences = (
  reference: ProjectionArtifactReference,
  value: Record<string, unknown>
): ProjectionArtifactReference[] | undefined => {
  const nested: ProjectionArtifactReference[] = []
  const add = (
    record: Record<string, unknown>,
    pathKey: string,
    shaKey: string,
    kind: ProjectionArtifactReference['kind'],
    baseDir: string | undefined,
    expectedJsonFields?: Record<string, string | number> | undefined,
    context?: ProjectionArtifactReference['context']
  ): boolean => {
    const child = createNestedArtifactReference(record, pathKey, shaKey, kind, baseDir, expectedJsonFields, context)
    if (!child) return false
    nested.push(child)
    return true
  }

  const collector = NESTED_COLLECTORS[reference.kind]
  if (!collector) return nested
  const success = collector({
    reference,
    value,
    renderDir: reference.context?.renderDir,
    nested,
    add
  })
  return success ? nested : undefined
}
