import { posix } from 'node:path'
import { createHash } from 'node:crypto'
import type {
  ArtifactFileDescriptor,
  EventReferenceListDescriptor,
  NestedCollector,
  ProjectionArtifactReference,
  ProjectionArtifactReferences,
  ProjectionShape,
  RenderCollectorContext
} from '~/types'
import { isRecord } from '~/utils/rest-client'
import { isOpaqueProtectedAssetRef, isSha256, isStrictArtifactRelativePath } from './guards'

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

export class ArtifactReferenceSink {
  private readonly files: ProjectionArtifactReference[] = []
  private readonly directories: string[] = []
  private readonly fileIdentities = new Set<string>()
  private readonly directoryPaths = new Set<string>()

  addFile(record: Record<string, unknown>, descriptor: ArtifactFileDescriptor): boolean {
    const path = resolveArtifactRelativePath(descriptor.baseDir, record[descriptor.pathKey])
    const sha256 = record[descriptor.shaKey]
    if (!path || !isSha256(sha256)) return false
    const reference: ProjectionArtifactReference = {
      path,
      sha256,
      scope: descriptor.scope ?? 'provider-artifact',
      kind: descriptor.kind,
      ...(descriptor.expectedJsonFields ? { expectedJsonFields: descriptor.expectedJsonFields } : {}),
      ...(descriptor.context ? { context: descriptor.context } : {})
    }
    const identity = JSON.stringify(reference)
    if (!this.fileIdentities.has(identity)) {
      this.fileIdentities.add(identity)
      this.files.push(reference)
    }
    return true
  }

  addDirectory(path: unknown): boolean {
    if (!isStrictArtifactRelativePath(path)) return false
    if (!this.directoryPaths.has(path)) {
      this.directoryPaths.add(path)
      this.directories.push(path)
    }
    return true
  }

  result(): ProjectionArtifactReferences {
    return { files: this.files, directories: this.directories }
  }
}

const selectProjectionShape = (projection: Record<string, unknown>): ProjectionShape | undefined => {
  const archive = projection['archive']
  if (isRecord(archive) && isRecord(projection['selectedSuccess']) && projection['activeWork'] === undefined) {
    return { kind: 'archive', archive }
  }
  const branchHistory = projection['branchHistory']
  const readinessAttempts = projection['readinessAttempts']
  const renderHistory = projection['renderHistory']
  if (!Array.isArray(branchHistory) || !Array.isArray(readinessAttempts) || !Array.isArray(renderHistory)) return undefined
  return { kind: 'active', branchHistory, readinessAttempts, renderHistory }
}

const collectArchiveProjection = (
  archive: Record<string, unknown>,
  targetKey: string,
  sink: ArtifactReferenceSink
): boolean => {
  const renderRef = archive['renderRef']
  const timelineRef = archive['timelineRef']
  const finalRef = archive['finalRef']
  if (!isRecord(renderRef) || !isRecord(timelineRef) || !isRecord(finalRef)) return false
  if (!sink.addFile(renderRef, {
    pathKey: 'path',
    shaKey: 'sha256',
    kind: 'compact-render',
    expectedJsonFields: { targetKey },
    scope: 'run-root'
  })) return false
  if (!sink.addFile(timelineRef, { pathKey: 'path', shaKey: 'sha256', kind: 'final-timeline', scope: 'run-root' })) return false
  return sink.addFile(finalRef, { pathKey: 'path', shaKey: 'sha256', kind: 'audio', scope: 'run-root' })
}

const collectBranchHistory = (
  branches: readonly unknown[],
  targetKey: string,
  sink: ArtifactReferenceSink
): boolean => {
  for (const branch of branches) {
    if (!isRecord(branch) || typeof branch['branchPlanId'] !== 'string') return false
    if (!sink.addFile(branch, {
      pathKey: 'branchPlanRef',
      shaKey: 'branchPlanSha256',
      kind: 'branch-plan',
      expectedJsonFields: { branchPlanId: branch['branchPlanId'], targetKey }
    })) return false
  }
  return true
}

const collectReadinessHistory = (
  attempts: readonly unknown[],
  targetKey: string,
  sink: ArtifactReferenceSink
): boolean => {
  for (const readiness of attempts) {
    if (!isRecord(readiness)) return false
    if (!sink.addFile(readiness, {
      pathKey: 'readinessResultRef',
      shaKey: 'readinessResultHash',
      kind: 'readiness-result',
      expectedJsonFields: { branchPlanId: readiness['branchPlanId'] as string, targetKey }
    })) return false
  }
  return true
}

const collectAdmissionJournal = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
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

const collectProviderRenderResult = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
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

const collectAudioRun = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
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

const collectReadinessAuthorization = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
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

const EVENT_REFERENCE_LISTS = [
  { key: 'outputRefs', kind: 'audio', renderRelative: false, includeRenderContext: true },
  { key: 'takeSelections', kind: 'take-selection', renderRelative: true, includeRenderContext: true },
  { key: 'continuationCheckpoints', kind: 'continuation-checkpoint', renderRelative: true, includeRenderContext: true },
  { key: 'cacheEvidenceRefs', kind: 'generic-json', renderRelative: true, includeRenderContext: true },
  { key: 'reportedOutputRefs', kind: 'audio', renderRelative: false, includeRenderContext: false, scope: 'run-root' }
] as const satisfies readonly EventReferenceListDescriptor[]

const collectEventReferenceList = (
  event: Record<string, unknown>,
  descriptor: EventReferenceListDescriptor,
  ctx: RenderCollectorContext
): boolean => {
  const list = event[descriptor.key]
  if (list === undefined) return true
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
  return true
}

const collectGenericEventLists = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  for (const descriptor of EVENT_REFERENCE_LISTS) {
    if (!collectEventReferenceList(event, descriptor, ctx)) return false
  }
  return true
}

const collectConsumedSelectionRebuild = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
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
    context: { renderDir: ctx.renderDir },
    scope: 'run-root'
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

const collectBatchProgress = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
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

const collectRenderEvent = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => {
  if (!collectAdmissionJournal(event, ctx)) return false
  if (!collectProviderRenderResult(event, ctx)) return false
  if (!collectAudioRun(event, ctx)) return false
  if (!collectReadinessAuthorization(event, ctx)) return false
  if (!collectGenericEventLists(event, ctx)) return false
  if (!collectConsumedSelectionRebuild(event, ctx)) return false
  return collectBatchProgress(event, ctx)
}

const collectRenderEvents = (events: readonly unknown[], ctx: RenderCollectorContext): boolean => {
  for (const event of events) {
    if (!isRecord(event) || !collectRenderEvent(event, ctx)) return false
  }
  return true
}

const collectRenderRecord = (
  rawRender: unknown,
  targetKey: string,
  sink: ArtifactReferenceSink
): boolean => {
  if (!isRecord(rawRender)) return false
  const renderPlanId = rawRender['renderPlanId']
  const renderIdentity = rawRender['renderIdentity']
  const renderDir = rawRender['renderDir']
  const events = rawRender['events']
  if (typeof renderPlanId !== 'string' || typeof renderIdentity !== 'string' || !Array.isArray(events)) return false
  if (!sink.addFile(rawRender, {
    pathKey: 'renderPlanRef',
    shaKey: 'renderPlanSha256',
    kind: 'render-plan',
    expectedJsonFields: { renderPlanId, renderIdentity, targetKey },
    context: { renderDir: renderDir as string }
  })) return false
  if (!sink.addDirectory(renderDir)) return false
  return collectRenderEvents(events, { targetKey, render: rawRender, renderPlanId, renderIdentity, renderDir: renderDir as string, sink })
}

const collectRenderHistory = (
  renders: readonly unknown[],
  targetKey: string,
  sink: ArtifactReferenceSink
): boolean => {
  for (const render of renders) {
    if (!collectRenderRecord(render, targetKey, sink)) return false
  }
  return true
}

export const collectProjectionArtifactReferences = (
  projection: Record<string, unknown>,
  targetKey: string
): ProjectionArtifactReferences | undefined => {
  const shape = selectProjectionShape(projection)
  if (!shape) return undefined
  const sink = new ArtifactReferenceSink()
  if (shape.kind === 'archive') {
    return collectArchiveProjection(shape.archive, targetKey, sink) ? sink.result() : undefined
  }
  if (!collectBranchHistory(shape.branchHistory, targetKey, sink)) return undefined
  if (!collectReadinessHistory(shape.readinessAttempts, targetKey, sink)) return undefined
  if (!collectRenderHistory(shape.renderHistory, targetKey, sink)) return undefined
  return sink.result()
}

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
