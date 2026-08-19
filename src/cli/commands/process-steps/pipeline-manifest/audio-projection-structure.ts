import type { AudioProjectionValidationContext, PipelineManifest, PipelineProviderState } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import {
  canonicalManifestJson,
  hasContiguousSequence,
  hasOnlyKeys,
  hasArtifactRef,
  isAppendOnlyArray,
  isAuditActor,
  isIsoDateTime,
  isSha256,
  isStrictArtifactRelativePath,
  isVoiceContextKey,
  validatesOptionalArtifactRef,
  PROVIDER_STATUS_SET
} from './guards'

export const resolveRenderEvent = (
  projection: Record<string, unknown>,
  renderIdentity: unknown,
  eventSequence: unknown
): Record<string, unknown> | undefined => {
  if (typeof renderIdentity !== 'string' || !Number.isInteger(eventSequence)) return undefined
  const renders = projection['renderHistory'] as unknown[]
  const matches = renders.filter((render) => isRecord(render) && render['renderIdentity'] === renderIdentity)
  const render = matches[0]
  if (matches.length !== 1 || !isRecord(render) || !Array.isArray(render['events'])) return undefined
  const events = render['events'] as unknown[]
  const eventMatches = events.filter((event) => isRecord(event) && event['sequence'] === eventSequence)
  return eventMatches.length === 1 ? eventMatches[0] as Record<string, unknown> : undefined
}

const createAudioProjectionValidationContext = (
  projection: Record<string, unknown>,
  targetKey: string
): AudioProjectionValidationContext | undefined => {
  const branchHistory = projection['branchHistory'] as unknown[]
  const readinessAttempts = projection['readinessAttempts'] as unknown[]
  const renderHistory = projection['renderHistory'] as unknown[]
  const pointerEvents = projection['pointerEvents'] as unknown[]

  if (
    !Array.isArray(branchHistory)
    || !Array.isArray(readinessAttempts)
    || !Array.isArray(renderHistory)
    || !Array.isArray(pointerEvents)
    || !hasContiguousSequence(branchHistory)
    || !hasContiguousSequence(readinessAttempts)
    || !hasContiguousSequence(pointerEvents)
  ) {
    return undefined
  }

  const createOnlyPaths = new Set<string>()
  const addCreateOnlyPath = (value: unknown): boolean => {
    if (typeof value !== 'string' || createOnlyPaths.has(value)) return false
    createOnlyPaths.add(value)
    return true
  }

  return {
    projection,
    targetKey,
    branchHistory,
    readinessAttempts,
    renderHistory,
    pointerEvents,
    createOnlyPaths,
    branchIds: new Set<string>(),
    renderIds: new Set<string>(),
    addCreateOnlyPath
  }
}

const validateBranchHistory = (ctx: AudioProjectionValidationContext): boolean => {
  for (const branch of ctx.branchHistory) {
    if (
      !isRecord(branch)
      || !hasOnlyKeys(branch, ['sequence', 'branchPlanId', 'branchPlanRef', 'branchPlanSha256', 'createdAt'])
      || typeof branch['branchPlanId'] !== 'string'
      || branch['branchPlanId'].trim().length === 0
      || ctx.branchIds.has(branch['branchPlanId'])
      || !hasArtifactRef(branch, 'branchPlanRef', 'branchPlanSha256')
      || !ctx.addCreateOnlyPath(branch['branchPlanRef'])
      || !isIsoDateTime(branch['createdAt'])
    ) return false
    ctx.branchIds.add(branch['branchPlanId'])
  }
  return true
}

const validateReadinessAttempts = (ctx: AudioProjectionValidationContext): boolean => {
  for (const readiness of ctx.readinessAttempts) {
    if (
      !isRecord(readiness)
      || !hasOnlyKeys(readiness, ['sequence', 'branchPlanId', 'readinessResultRef', 'readinessResultHash', 'accountObservationHashes', 'at', 'status', 'admissionDisposition', 'error'])
      || typeof readiness['branchPlanId'] !== 'string'
      || !ctx.branchIds.has(readiness['branchPlanId'])
      || !hasArtifactRef(readiness, 'readinessResultRef', 'readinessResultHash')
      || !ctx.addCreateOnlyPath(readiness['readinessResultRef'])
      || !Array.isArray(readiness['accountObservationHashes'])
      || readiness['accountObservationHashes'].some((hash) => !isSha256(hash))
      || !isIsoDateTime(readiness['at'])
      || !(
        (readiness['status'] === 'ready' && readiness['admissionDisposition'] === 'eligible' && readiness['error'] === undefined)
        || (readiness['status'] === 'ready' && readiness['admissionDisposition'] === 'peer-blocked' && isRecord(readiness['error']))
        || (readiness['status'] === 'blocked' && readiness['admissionDisposition'] === 'self-blocked' && isRecord(readiness['error']))
      )
    ) return false
  }
  return true
}

const validateReadinessAuthorization = (
  ctx: AudioProjectionValidationContext,
  event: Record<string, unknown>
): boolean => {
  const hasAdmissionJournal = event['admissionJournalRef'] !== undefined
  if (hasAdmissionJournal !== (event['admissionJournalSnapshotId'] !== undefined)) return false
  const readinessAuthorization = event['readinessAuthorization']
  if (hasAdmissionJournal !== (readinessAuthorization !== undefined)) return false
  if (readinessAuthorization !== undefined) {
    if (
      !isRecord(readinessAuthorization)
      || !hasOnlyKeys(readinessAuthorization, [
        'readinessAttemptSequence', 'branchPlanId', 'branchCandidateId',
        'readinessResultRef', 'readinessResultHash', 'accountObservationHashes'
      ])
      || !Number.isInteger(readinessAuthorization['readinessAttemptSequence'])
      || typeof readinessAuthorization['branchPlanId'] !== 'string'
      || typeof readinessAuthorization['branchCandidateId'] !== 'string'
      || readinessAuthorization['branchCandidateId'].trim().length === 0
      || !hasArtifactRef(readinessAuthorization, 'readinessResultRef', 'readinessResultHash')
      || !Array.isArray(readinessAuthorization['accountObservationHashes'])
      || readinessAuthorization['accountObservationHashes'].some((hash) => !isSha256(hash))
    ) return false
    const authorizedReadiness = ctx.readinessAttempts.filter((entry) =>
      isRecord(entry)
      && entry['sequence'] === readinessAuthorization['readinessAttemptSequence']
      && entry['branchPlanId'] === readinessAuthorization['branchPlanId']
      && entry['status'] === 'ready'
      && entry['admissionDisposition'] === 'eligible'
    )
    const readiness = authorizedReadiness[0]
    if (
      authorizedReadiness.length !== 1
      || !isRecord(readiness)
      || readiness['readinessResultRef'] !== readinessAuthorization['readinessResultRef']
      || readiness['readinessResultHash'] !== readinessAuthorization['readinessResultHash']
      || canonicalManifestJson(readiness['accountObservationHashes']) !== canonicalManifestJson(readinessAuthorization['accountObservationHashes'])
    ) return false
  }
  return true
}

const validateRenderEventStatusRules = (event: Record<string, unknown>): boolean => {
  if (event['status'] === 'missing' && (
    event['readinessAuthorization'] !== undefined
    || event['admissionJournalSnapshotId'] !== undefined
    || event['admissionJournalRef'] !== undefined
    || event['providerRenderResultIdentity'] !== undefined
    || event['providerRenderResultRef'] !== undefined
    || event['batchProgress'] !== undefined
    || event['outputRefs'] !== undefined
    || event['reportedOutputRefs'] !== undefined
    || event['takeSelections'] !== undefined
    || event['continuationCheckpoints'] !== undefined
    || event['cacheEvidenceRefs'] !== undefined
    || event['consumedSelectionRebuild'] !== undefined
    || event['audioRunId'] !== undefined
    || event['audioRunRef'] !== undefined
    || event['error'] !== undefined
  )) return false
  if (event['status'] === 'failed' && event['attempt'] === 0 && (
    event['readinessAuthorization'] !== undefined
    || event['admissionJournalSnapshotId'] !== undefined
    || event['admissionJournalRef'] !== undefined
    || event['admissionJournalSha256'] !== undefined
    || event['providerRenderResultIdentity'] !== undefined
    || event['providerRenderResultRef'] !== undefined
    || event['providerRenderResultSha256'] !== undefined
    || event['batchProgress'] !== undefined
    || event['outputRefs'] !== undefined
    || event['reportedOutputRefs'] !== undefined
    || event['takeSelections'] !== undefined
    || event['continuationCheckpoints'] !== undefined
    || event['cacheEvidenceRefs'] !== undefined
    || event['consumedSelectionRebuild'] !== undefined
    || event['audioRunId'] !== undefined
    || event['audioRunRef'] !== undefined
    || event['audioRunSha256'] !== undefined
  )) return false
  for (const listKey of ['outputRefs', 'takeSelections', 'continuationCheckpoints', 'cacheEvidenceRefs'] as const) {
    const list = event[listKey]
    if (list !== undefined && (!Array.isArray(list) || list.some((entry) => !isRecord(entry) || !hasArtifactRef(entry, 'path', 'sha256')))) {
      return false
    }
  }
  const reportedOutputs = event['reportedOutputRefs']
  if (
    reportedOutputs !== undefined
    && (
      event['status'] !== 'succeeded'
      || !Array.isArray(reportedOutputs)
      || reportedOutputs.length === 0
      || reportedOutputs.some((entry) => !isRecord(entry) || !hasArtifactRef(entry, 'path', 'sha256'))
    )
  ) return false
  if (event['status'] === 'succeeded' && (
    typeof event['providerRenderResultIdentity'] !== 'string'
    || typeof event['audioRunId'] !== 'string'
    || !hasArtifactRef(event, 'providerRenderResultRef', 'providerRenderResultSha256')
    || !hasArtifactRef(event, 'audioRunRef', 'audioRunSha256')
    || !Array.isArray(event['outputRefs'])
    || event['outputRefs'].length === 0
    || !Array.isArray(event['reportedOutputRefs'])
    || event['reportedOutputRefs'].length === 0
    || event['error'] !== undefined
  )) return false
  if (event['status'] === 'failed' && !isRecord(event['error'])) return false
  return true
}

const validateRenderEvent = (
  ctx: AudioProjectionValidationContext,
  event: Record<string, unknown>
): boolean => {
  if (
    !hasOnlyKeys(event, [
      'sequence', 'status', 'at', 'attempt', 'readinessAuthorization',
      'admissionJournalSnapshotId', 'admissionJournalRef', 'admissionJournalSha256',
      'providerRenderResultIdentity', 'providerRenderResultRef', 'providerRenderResultSha256',
      'batchProgress', 'outputRefs', 'reportedOutputRefs', 'takeSelections', 'continuationCheckpoints',
      'cacheEvidenceRefs', 'consumedSelectionRebuild', 'audioRunId', 'audioRunRef',
      'audioRunSha256', 'error'
    ])
    || (event['status'] !== 'missing' && event['status'] !== 'running' && event['status'] !== 'succeeded' && event['status'] !== 'failed')
    || !isIsoDateTime(event['at'])
    || !Number.isInteger(event['attempt'])
    || (
      event['status'] === 'missing'
        ? event['attempt'] !== 0
        : event['status'] === 'failed'
          ? (event['attempt'] as number) < 0
          : (event['attempt'] as number) < 1
    )
    || !validatesOptionalArtifactRef(event, 'admissionJournalRef', 'admissionJournalSha256')
    || !validatesOptionalArtifactRef(event, 'providerRenderResultRef', 'providerRenderResultSha256')
    || !validatesOptionalArtifactRef(event, 'audioRunRef', 'audioRunSha256')
  ) return false

  if (!validateReadinessAuthorization(ctx, event)) return false
  return validateRenderEventStatusRules(event)
}

const validateRenderHistory = (ctx: AudioProjectionValidationContext): boolean => {
  for (const render of ctx.renderHistory) {
    if (
      !isRecord(render)
      || !hasOnlyKeys(render, ['renderIdentity', 'renderPlanId', 'renderPlanRef', 'renderPlanSha256', 'voiceContextKey', 'synthesisSettingsHash', 'outputProfileHash', 'renderDir', 'events'])
      || typeof render['renderIdentity'] !== 'string'
      || render['renderIdentity'].trim().length === 0
      || ctx.renderIds.has(render['renderIdentity'])
      || typeof render['renderPlanId'] !== 'string'
      || !hasArtifactRef(render, 'renderPlanRef', 'renderPlanSha256')
      || !ctx.addCreateOnlyPath(render['renderPlanRef'])
      || !isVoiceContextKey(render['voiceContextKey'])
      || !isSha256(render['synthesisSettingsHash'])
      || !isSha256(render['outputProfileHash'])
      || !isStrictArtifactRelativePath(render['renderDir'])
      || !ctx.addCreateOnlyPath(render['renderDir'])
      || !Array.isArray(render['events'])
      || render['events'].length === 0
      || !hasContiguousSequence(render['events'])
    ) return false
    ctx.renderIds.add(render['renderIdentity'])
    for (const rawEvent of render['events']) {
      if (!isRecord(rawEvent) || !validateRenderEvent(ctx, rawEvent)) return false
    }
  }
  return true
}

const validatePointerEvents = (ctx: AudioProjectionValidationContext): boolean => {
  for (const pointer of ctx.pointerEvents) {
    if (!isRecord(pointer) || !isAuditActor(pointer['actor']) || !isIsoDateTime(pointer['at'])) return false
    const action = pointer['action']
    if (action === 'activate-branch') {
      if (
        !hasOnlyKeys(pointer, ['sequence', 'action', 'branchPlanId', 'actor', 'at'])
        || typeof pointer['branchPlanId'] !== 'string'
        || !ctx.branchIds.has(pointer['branchPlanId'])
      ) return false
    } else if (action === 'project-branch-readiness') {
      if (
        !hasOnlyKeys(pointer, ['sequence', 'action', 'branchPlanId', 'readinessAttemptSequence', 'actor', 'at'])
        || !ctx.readinessAttempts.some((entry) => isRecord(entry) && entry['branchPlanId'] === pointer['branchPlanId'] && entry['sequence'] === pointer['readinessAttemptSequence'])
      ) return false
    } else if (action === 'activate-render') {
      if (
        !hasOnlyKeys(pointer, ['sequence', 'action', 'renderIdentity', 'eventSequence', 'actor', 'at'])
        || !resolveRenderEvent(ctx.projection, pointer['renderIdentity'], pointer['eventSequence'])
      ) return false
    } else if (action === 'rollback-active' || action === 'select-success') {
      const event = resolveRenderEvent(ctx.projection, pointer['renderIdentity'], pointer['eventSequence'])
      if (
        !hasOnlyKeys(pointer, ['sequence', 'action', 'renderIdentity', 'eventSequence', 'resultIdentity', 'audioRunId', 'actor', 'at'])
        || event?.['status'] !== 'succeeded'
        || event['providerRenderResultIdentity'] !== pointer['resultIdentity']
        || event['audioRunId'] !== pointer['audioRunId']
      ) return false
    } else if (action === 'activate-policy-skip') {
      if (!hasOnlyKeys(pointer, ['sequence', 'action', 'skipId', 'actor', 'at']) || typeof pointer['skipId'] !== 'string') return false
    } else {
      return false
    }
  }
  return true
}

const validateSelectedSuccess = (ctx: AudioProjectionValidationContext): boolean => {
  const selected = ctx.projection['selectedSuccess']
  if (selected === undefined) return true
  if (
    !isRecord(selected)
    || !hasOnlyKeys(selected, ['renderIdentity', 'eventSequence', 'resultIdentity', 'audioRunId'])
  ) return false
  const selectedEvent = resolveRenderEvent(ctx.projection, selected['renderIdentity'], selected['eventSequence'])
  if (
    selectedEvent?.['status'] !== 'succeeded'
    || selectedEvent['providerRenderResultIdentity'] !== selected['resultIdentity']
    || selectedEvent['audioRunId'] !== selected['audioRunId']
    || !ctx.pointerEvents.some((pointer) =>
      isRecord(pointer)
      && (pointer['action'] === 'select-success' || pointer['action'] === 'rollback-active')
      && pointer['renderIdentity'] === selected['renderIdentity']
      && pointer['eventSequence'] === selected['eventSequence']
      && pointer['resultIdentity'] === selected['resultIdentity']
      && pointer['audioRunId'] === selected['audioRunId']
    )
  ) return false
  return true
}

const validateActiveWork = (ctx: AudioProjectionValidationContext): boolean => {
  const active = ctx.projection['activeWork']
  if (!isRecord(active)) return false
  const latestPointer = ctx.pointerEvents.at(-1)
  if (active['kind'] === 'branch') {
    if (
      !hasOnlyKeys(active, ['kind', 'branchPlanId', 'readinessAttemptSequence'])
      || typeof active['branchPlanId'] !== 'string'
      || !ctx.branchIds.has(active['branchPlanId'])
      || (active['readinessAttemptSequence'] !== undefined && !ctx.readinessAttempts.some((entry) =>
        isRecord(entry)
        && entry['branchPlanId'] === active['branchPlanId']
        && entry['sequence'] === active['readinessAttemptSequence']
      ))
      || !isRecord(latestPointer)
      || (
        latestPointer['action'] !== 'activate-branch'
        && latestPointer['action'] !== 'project-branch-readiness'
      )
      || latestPointer['branchPlanId'] !== active['branchPlanId']
    ) return false
  } else if (active['kind'] === 'render') {
    if (
      !hasOnlyKeys(active, ['kind', 'renderIdentity', 'eventSequence', 'journalPath', 'completedSlotHashes'])
      || !resolveRenderEvent(ctx.projection, active['renderIdentity'], active['eventSequence'])
      || !isRecord(latestPointer)
      || !['activate-render', 'rollback-active', 'select-success'].includes(latestPointer['action'] as string)
      || latestPointer['renderIdentity'] !== active['renderIdentity']
      || latestPointer['eventSequence'] !== active['eventSequence']
    ) return false
  } else if (active['kind'] === 'policy-skip') {
    const evidence = active['evidence']
    if (
      !hasOnlyKeys(active, ['kind', 'evidence'])
      || !isRecord(evidence)
      || evidence['schemaVersion'] !== 1
      || typeof evidence['skipId'] !== 'string'
      || evidence['targetKey'] !== ctx.targetKey
      || (evidence['reasonCode'] !== 'user-requested' && evidence['reasonCode'] !== 'project-policy' && evidence['reasonCode'] !== 'rights-policy')
      || typeof evidence['reason'] !== 'string'
      || evidence['reason'].trim().length === 0
      || !isAuditActor(evidence['actor'])
      || !isIsoDateTime(evidence['at'])
      || ctx.branchHistory.length !== 0
      || ctx.readinessAttempts.length !== 0
      || ctx.renderHistory.length !== 0
      || ctx.projection['selectedSuccess'] !== undefined
      || !isRecord(latestPointer)
      || latestPointer['action'] !== 'activate-policy-skip'
      || latestPointer['skipId'] !== evidence['skipId']
    ) return false
  } else {
    return false
  }
  return true
}

const PROJECTION_VALIDATION_STEPS: readonly ((ctx: AudioProjectionValidationContext) => boolean)[] = [
  validateBranchHistory,
  validateReadinessAttempts,
  validateRenderHistory,
  validatePointerEvents,
  validateSelectedSuccess,
  validateActiveWork
]

export const validateAudioProjectionStructure = (
  projection: Record<string, unknown>,
  targetKey: string
): boolean => {
  const ctx = createAudioProjectionValidationContext(projection, targetKey)
  if (!ctx) return false
  return PROJECTION_VALIDATION_STEPS.every((step) => step(ctx))
}

export const parseAudioProjectionStatus = (
  value: unknown,
  targetKey: string
): { status: PipelineProviderState['status'], attempts: number } | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['activeWork', 'selectedSuccess', 'archive', 'branchHistory', 'readinessAttempts', 'renderHistory', 'pointerEvents'])
    || !Array.isArray(value['branchHistory'])
    || !Array.isArray(value['readinessAttempts'])
    || !Array.isArray(value['renderHistory'])
    || !Array.isArray(value['pointerEvents'])
  ) {
    return undefined
  }
  if (isRecord(value['archive']) && isRecord(value['selectedSuccess']) && value['activeWork'] === undefined) {
    const archive = value['archive']
    const selected = value['selectedSuccess']
    if (
      archive['schemaVersion'] !== 1
      || !isRecord(archive['renderRef'])
      || !isRecord(archive['timelineRef'])
      || !isRecord(archive['finalRef'])
      || !Number.isInteger(archive['slotCount'])
      || typeof selected['renderIdentity'] !== 'string'
      || typeof selected['resultIdentity'] !== 'string'
      || typeof selected['audioRunId'] !== 'string'
    ) {
      return undefined
    }
    return { status: 'succeeded', attempts: 0 }
  }
  if (!isRecord(value['activeWork']) || !validateAudioProjectionStructure(value, targetKey)) {
    return undefined
  }

  const active = value['activeWork']
  if (active['kind'] === 'policy-skip') {
    const evidence = active['evidence']
    if (
      !hasOnlyKeys(active, ['kind', 'evidence'])
      || !isRecord(evidence)
      || evidence['schemaVersion'] !== 1
      || typeof evidence['skipId'] !== 'string'
      || typeof evidence['targetKey'] !== 'string'
      || evidence['targetKey'] !== targetKey
      || (evidence['reasonCode'] !== 'user-requested' && evidence['reasonCode'] !== 'project-policy' && evidence['reasonCode'] !== 'rights-policy')
      || typeof evidence['reason'] !== 'string'
      || evidence['reason'].trim().length === 0
      || value['branchHistory'].length !== 0
      || value['readinessAttempts'].length !== 0
      || value['renderHistory'].length !== 0
      || value['selectedSuccess'] !== undefined
    ) {
      return undefined
    }
    return { status: 'skipped', attempts: 0 }
  }

  if (active['kind'] === 'branch') {
    if (
      !hasOnlyKeys(active, ['kind', 'branchPlanId', 'readinessAttemptSequence'])
      || typeof active['branchPlanId'] !== 'string'
      || (active['readinessAttemptSequence'] !== undefined && (!Number.isInteger(active['readinessAttemptSequence']) || (active['readinessAttemptSequence'] as number) < 0))
    ) {
      return undefined
    }
    if (active['readinessAttemptSequence'] === undefined) {
      return { status: 'missing', attempts: 0 }
    }
    const matches = value['readinessAttempts'].filter((attempt) =>
      isRecord(attempt)
      && attempt['sequence'] === active['readinessAttemptSequence']
      && attempt['branchPlanId'] === active['branchPlanId']
    )
    if (matches.length !== 1) return undefined
    const readiness = matches[0]
    if (!readiness) return undefined
    if (readiness['status'] === 'ready' && readiness['admissionDisposition'] === 'eligible') {
      return { status: 'missing', attempts: 0 }
    }
    if (
      (readiness['status'] === 'ready' && readiness['admissionDisposition'] === 'peer-blocked')
      || (readiness['status'] === 'blocked' && readiness['admissionDisposition'] === 'self-blocked')
    ) {
      return { status: 'failed', attempts: 0 }
    }
    return undefined
  }

  if (
    active['kind'] !== 'render'
    || !hasOnlyKeys(active, ['kind', 'renderIdentity', 'eventSequence', 'journalPath', 'completedSlotHashes'])
    || typeof active['renderIdentity'] !== 'string'
    || !Number.isInteger(active['eventSequence'])
  ) {
    return undefined
  }
  const renderMatches = value['renderHistory'].filter((render) =>
    isRecord(render) && render['renderIdentity'] === active['renderIdentity']
  )
  if (renderMatches.length !== 1) return undefined
  const render = renderMatches[0]
  if (!render || !Array.isArray(render['events'])) return undefined
  const eventMatches = render['events'].filter((event) =>
    isRecord(event) && event['sequence'] === active['eventSequence']
  )
  if (eventMatches.length !== 1) return undefined
  const event = eventMatches[0]
  if (
    !event
    || typeof event['status'] !== 'string'
    || !PROVIDER_STATUS_SET.has(event['status'])
    || !Number.isInteger(event['attempt'])
    || (event['attempt'] as number) < 0
  ) {
    return undefined
  }
  const status = event['status'] as PipelineProviderState['status']
  if (status === 'skipped') return undefined
  if (status === 'succeeded') {
    const triples = [
      ['providerRenderResultIdentity', 'providerRenderResultRef', 'providerRenderResultSha256'],
      ['audioRunId', 'audioRunRef', 'audioRunSha256']
    ] as const
    if (triples.some((keys) => keys.some((key) => typeof event[key] !== 'string'))) return undefined
    const selected = value['selectedSuccess']
    if (
      !isRecord(selected)
      || selected['renderIdentity'] !== active['renderIdentity']
      || selected['eventSequence'] !== active['eventSequence']
      || selected['resultIdentity'] !== event['providerRenderResultIdentity']
      || selected['audioRunId'] !== event['audioRunId']
    ) {
      return undefined
    }
  }
  return { status, attempts: event['attempt'] as number }
}

export const assertAppendOnlyAudioProjection = (
  before: PipelineProviderState,
  after: PipelineProviderState
): void => {
  if (
    before.operation !== after.operation
    || before.targetKey !== after.targetKey
    || before.transport !== after.transport
    || before.service !== after.service
    || before.model !== after.model
    || before.artifactDir !== after.artifactDir
    || canonicalManifestJson(before.options) !== canonicalManifestJson(after.options)
  ) {
    throw CLIUsageError('An audio provider-state update cannot change operation-scoped identity, its artifact directory, or immutable provider options.')
  }
  const namespace = before.operation === 'comic-audio' ? 'comicAudio' : before.operation === 'tts-synthesis' ? 'ttsAudio' : undefined
  if (!namespace) return
  const beforeProjection = before.result?.[namespace]
  const afterProjection = after.result?.[namespace]
  if (!isRecord(beforeProjection) || !isRecord(afterProjection)) {
    throw CLIUsageError('An audio provider-state update requires its canonical projection.')
  }
  for (const key of ['branchHistory', 'readinessAttempts', 'pointerEvents'] as const) {
    const oldEntries = beforeProjection[key]
    const nextEntries = afterProjection[key]
    if (!Array.isArray(oldEntries) || !Array.isArray(nextEntries) || !isAppendOnlyArray(oldEntries, nextEntries)) {
      throw CLIUsageError(`Canonical audio ${key} is append-only.`)
    }
  }
  const oldRenders = beforeProjection['renderHistory']
  const nextRenders = afterProjection['renderHistory']
  if (!Array.isArray(oldRenders) || !Array.isArray(nextRenders) || oldRenders.length > nextRenders.length) {
    throw CLIUsageError('Canonical audio renderHistory is append-only.')
  }
  for (const [index, oldRender] of oldRenders.entries()) {
    const nextRender = nextRenders[index]
    if (!isRecord(oldRender) || !isRecord(nextRender)) {
      throw CLIUsageError('Canonical audio render history contains an invalid record.')
    }
    const { events: oldEvents, ...oldHeader } = oldRender
    const { events: nextEvents, ...nextHeader } = nextRender
    if (
      canonicalManifestJson(oldHeader) !== canonicalManifestJson(nextHeader)
      || !Array.isArray(oldEvents)
      || !Array.isArray(nextEvents)
      || !isAppendOnlyArray(oldEvents, nextEvents)
    ) {
      throw CLIUsageError('Canonical audio render records and events are append-only.')
    }
  }
  const beforeActive = canonicalManifestJson(beforeProjection['activeWork'])
  const afterActive = canonicalManifestJson(afterProjection['activeWork'])
  const beforeSelected = beforeProjection['selectedSuccess']
  const afterSelected = afterProjection['selectedSuccess']
  const oldPointers = beforeProjection['pointerEvents'] as unknown[]
  const nextPointers = afterProjection['pointerEvents'] as unknown[]
  const appendedPointers = nextPointers.slice(oldPointers.length)
  if (beforeActive !== afterActive && appendedPointers.length === 0) {
    throw CLIUsageError('Canonical audio activeWork may change only through an appended pointer event.')
  }
  if (beforeSelected !== undefined && afterSelected === undefined) {
    throw CLIUsageError('Canonical audio selectedSuccess cannot be cleared by later work.')
  }
  if (canonicalManifestJson(beforeSelected) !== canonicalManifestJson(afterSelected)) {
    const pointer = appendedPointers.at(-1)
    if (
      !isRecord(pointer)
      || (pointer['action'] !== 'select-success' && pointer['action'] !== 'rollback-active')
      || !isRecord(afterSelected)
      || pointer['renderIdentity'] !== afterSelected['renderIdentity']
      || pointer['eventSequence'] !== afterSelected['eventSequence']
      || pointer['resultIdentity'] !== afterSelected['resultIdentity']
      || pointer['audioRunId'] !== afterSelected['audioRunId']
    ) {
      throw CLIUsageError('Canonical audio selectedSuccess may change only through an appended exact success pointer.')
    }
  }
}

export const assertAppendOnlyManifestAudioState = (
  before: PipelineManifest,
  after: PipelineManifest
): void => {
  if (before.command !== after.command || before.scope !== after.scope || before.createdAt !== after.createdAt) {
    throw CLIUsageError('A canonical manifest cannot change its command, scope, or creation identity.')
  }
  if (before.command !== 'tts' && before.command !== 'comic') return
  if (before.items.length !== after.items.length) {
    throw CLIUsageError('A canonical audio manifest cannot replace or remove existing items.')
  }
  for (const [itemIndex, oldItem] of before.items.entries()) {
    const nextItem = after.items[itemIndex]
    if (!nextItem || oldItem.input !== nextItem.input) {
      throw CLIUsageError('A canonical audio manifest cannot reorder or replace an existing item.')
    }
    for (const oldProvider of oldItem.providers) {
      if (oldProvider.legacyRenderIdentity?.startsWith('legacy:')) {
        const retainedLegacy = nextItem.providers.filter((provider) =>
          provider.legacyRenderIdentity === oldProvider.legacyRenderIdentity
        )
        if (retainedLegacy.length !== 1) {
          throw CLIUsageError(`Legacy audio target ${oldProvider.targetKey ?? oldProvider.service} cannot be removed, duplicated, or rewritten.`)
        }
        continue
      }
      if (
        (oldProvider.operation !== 'tts-synthesis' && oldProvider.operation !== 'comic-audio')
      ) continue
      const nextMatches = nextItem.providers.filter((provider) => provider.targetKey === oldProvider.targetKey)
      if (nextMatches.length !== 1) {
        throw CLIUsageError(`Canonical audio target ${oldProvider.targetKey ?? oldProvider.service} cannot be removed or duplicated.`)
      }
      assertAppendOnlyAudioProjection(oldProvider, nextMatches[0] as PipelineProviderState)
    }
    for (const nextProvider of nextItem.providers) {
      if (
        nextProvider.legacyRenderIdentity?.startsWith('legacy:')
        && !oldItem.providers.some((provider) => provider.legacyRenderIdentity === nextProvider.legacyRenderIdentity)
      ) {
        throw CLIUsageError(`A canonical audio manifest cannot introduce legacy provider state for ${nextProvider.service}/${nextProvider.model ?? ''}.`)
      }
    }
  }
}
