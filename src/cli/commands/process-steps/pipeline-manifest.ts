import { lstat, readFile, readdir, realpath, rename, rm } from 'node:fs/promises'
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { PIPELINE_ITEM_STATUSES, PIPELINE_PROVIDER_STATUSES, PROCESS_COMMANDS } from '~/types'
import type { AccountCapabilityObservation, AnyCapabilityRecord, AudioRun, CacheMaterializationPlan, CanonicalComicItemMetadata, ComicDialoguePlan, ComicSourceIdentity, ExtractRoute, GenericTtsDialoguePlan, GenericTtsSourceIdentity, InputFamily, PipelineItemRecord, PipelineManifest, PipelineManifestChildLink, PipelineManifestItem, PipelineProviderState, ProcessCommand, ProviderBatchInvocationPlan, ProviderBatchResult, ProviderReadinessResult, ProviderRenderBranchPlan, ProviderRenderPlan, ProviderRenderResult, RenderAdmissionJournalSnapshot } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { assertContentIdentity, computeLegacySingleRenderIdentity, hashCanonicalTtsValue } from './step-4-tts/script-to-audio/contract-identity'
import { validateAccountCapabilityObservation, validateCacheMaterializationPlan, validateCapabilityFacetSet, validateGenericTtsDialoguePlan, validateGenericTtsSourceIdentity, validateProviderBatchResult, validateProviderRenderPlanIdentity, validateProviderRenderResult, validateRenderAdmissionJournalSnapshot } from './step-4-tts/script-to-audio/contract-validation'
import { parseTtsDialoguePlanArtifactRef, readTtsDialoguePlanArtifact } from './step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { validateComicDialoguePlan, validateComicSourceIdentity } from './step-8-comic/comic-utils/comic-audio-contracts'

export const PIPELINE_MANIFEST_FILE = 'manifest.json'

const PROCESS_COMMAND_SET = new Set<string>(PROCESS_COMMANDS)
const ITEM_STATUS_SET = new Set<string>(PIPELINE_ITEM_STATUSES)
const PROVIDER_STATUS_SET = new Set<string>(PIPELINE_PROVIDER_STATUSES)
const INPUT_FAMILY_SET = new Set(['media', 'document', 'html_article', 'x_space', 'unsupported'])
const EXTRACT_ROUTE_SET = new Set(['media', 'document', 'article', 'x-space'])
const SHA256_PATTERN = /^[a-f0-9]{64}$/

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): boolean => {
  const allowed = new Set(allowedKeys)
  return Object.keys(value).every((key) => allowed.has(key))
}

const isProcessCommand = (value: unknown): value is ProcessCommand =>
  typeof value === 'string' && PROCESS_COMMAND_SET.has(value)

const isInputFamily = (value: unknown): value is InputFamily =>
  typeof value === 'string' && INPUT_FAMILY_SET.has(value)

const isExtractRoute = (value: unknown): value is ExtractRoute =>
  typeof value === 'string' && EXTRACT_ROUTE_SET.has(value)

const isSafeRelativePath = (rootDir: string, value: string): boolean => {
  if (value.length === 0 || isAbsolute(value)) {
    return false
  }
  const root = resolve(rootDir)
  const target = resolve(root, value)
  const fromRoot = relative(root, target)
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot))
}

const hasPersistedKey = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.propertyIsEnumerable.call(value, key)

const canonicalManifestJson = (value: unknown): string => {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(normalize)
    if (isRecord(entry)) {
      return Object.fromEntries(
        Object.keys(entry).sort().flatMap((key) => entry[key] === undefined ? [] : [[key, normalize(entry[key])]])
      )
    }
    return entry
  }
  return JSON.stringify(normalize(value))
}

const isIsoDateTime = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && SHA256_PATTERN.test(value)

const isVoiceContextKey = (value: unknown): value is string =>
  isSha256(value)
  || (typeof value === 'string' && value.startsWith('approved:') && value.length > 'approved:'.length)

const isStrictArtifactRelativePath = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value === '.' || isAbsolute(value) || value.includes('\\')) {
    return false
  }
  const segments = value.split('/')
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

const hasContiguousSequence = (entries: unknown[]): boolean =>
  entries.every((entry, index) => isRecord(entry) && entry['sequence'] === index + 1)

const isAuditActor = (value: unknown): boolean =>
  isRecord(value)
  && hasOnlyKeys(value, ['namespace', 'actorId'])
  && (value['namespace'] === 'local-user' || value['namespace'] === 'project-role' || value['namespace'] === 'automation')
  && typeof value['actorId'] === 'string'
  && value['actorId'].trim().length > 0

const hasArtifactRef = (
  value: Record<string, unknown>,
  refKey: string,
  shaKey: string
): boolean => isStrictArtifactRelativePath(value[refKey]) && isSha256(value[shaKey])

const validatesOptionalArtifactRef = (
  value: Record<string, unknown>,
  refKey: string,
  shaKey: string
): boolean => {
  const hasRef = value[refKey] !== undefined
  const hasSha = value[shaKey] !== undefined
  return hasRef === hasSha && (!hasRef || hasArtifactRef(value, refKey, shaKey))
}

const resolveRenderEvent = (
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

const validateAudioProjectionStructure = (
  projection: Record<string, unknown>,
  targetKey: string
): boolean => {
  const branchHistory = projection['branchHistory'] as unknown[]
  const readinessAttempts = projection['readinessAttempts'] as unknown[]
  const renderHistory = projection['renderHistory'] as unknown[]
  const pointerEvents = projection['pointerEvents'] as unknown[]
  const createOnlyPaths = new Set<string>()
  const addCreateOnlyPath = (value: unknown): boolean => {
    if (typeof value !== 'string' || createOnlyPaths.has(value)) return false
    createOnlyPaths.add(value)
    return true
  }
  if (
    !hasContiguousSequence(branchHistory)
    || !hasContiguousSequence(readinessAttempts)
    || !hasContiguousSequence(pointerEvents)
  ) return false

  const branchIds = new Set<string>()
  for (const branch of branchHistory) {
    if (
      !isRecord(branch)
      || !hasOnlyKeys(branch, ['sequence', 'branchPlanId', 'branchPlanRef', 'branchPlanSha256', 'createdAt'])
      || typeof branch['branchPlanId'] !== 'string'
      || branch['branchPlanId'].trim().length === 0
      || branchIds.has(branch['branchPlanId'])
      || !hasArtifactRef(branch, 'branchPlanRef', 'branchPlanSha256')
      || !addCreateOnlyPath(branch['branchPlanRef'])
      || !isIsoDateTime(branch['createdAt'])
    ) return false
    branchIds.add(branch['branchPlanId'])
  }

  for (const readiness of readinessAttempts) {
    if (
      !isRecord(readiness)
      || !hasOnlyKeys(readiness, ['sequence', 'branchPlanId', 'readinessResultRef', 'readinessResultHash', 'accountObservationHashes', 'at', 'status', 'admissionDisposition', 'error'])
      || typeof readiness['branchPlanId'] !== 'string'
      || !branchIds.has(readiness['branchPlanId'])
      || !hasArtifactRef(readiness, 'readinessResultRef', 'readinessResultHash')
      || !addCreateOnlyPath(readiness['readinessResultRef'])
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

  const renderIds = new Set<string>()
  for (const render of renderHistory) {
    if (
      !isRecord(render)
      || !hasOnlyKeys(render, ['renderIdentity', 'renderPlanId', 'renderPlanRef', 'renderPlanSha256', 'voiceContextKey', 'synthesisSettingsHash', 'outputProfileHash', 'renderDir', 'events'])
      || typeof render['renderIdentity'] !== 'string'
      || render['renderIdentity'].trim().length === 0
      || renderIds.has(render['renderIdentity'])
      || typeof render['renderPlanId'] !== 'string'
      || !hasArtifactRef(render, 'renderPlanRef', 'renderPlanSha256')
      || !addCreateOnlyPath(render['renderPlanRef'])
      || !isVoiceContextKey(render['voiceContextKey'])
      || !isSha256(render['synthesisSettingsHash'])
      || !isSha256(render['outputProfileHash'])
      || !isStrictArtifactRelativePath(render['renderDir'])
      || !addCreateOnlyPath(render['renderDir'])
      || !Array.isArray(render['events'])
      || render['events'].length === 0
      || !hasContiguousSequence(render['events'])
    ) return false
    renderIds.add(render['renderIdentity'])
    for (const rawEvent of render['events']) {
      if (!isRecord(rawEvent)) return false
      const event = rawEvent
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
        const authorizedReadiness = readinessAttempts.filter((entry) =>
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
    }
  }

  for (const pointer of pointerEvents) {
    if (!isRecord(pointer) || !isAuditActor(pointer['actor']) || !isIsoDateTime(pointer['at'])) return false
    const action = pointer['action']
    if (action === 'activate-branch') {
      if (
        !hasOnlyKeys(pointer, ['sequence', 'action', 'branchPlanId', 'actor', 'at'])
        || typeof pointer['branchPlanId'] !== 'string'
        || !branchIds.has(pointer['branchPlanId'])
      ) return false
    } else if (action === 'project-branch-readiness') {
      if (
        !hasOnlyKeys(pointer, ['sequence', 'action', 'branchPlanId', 'readinessAttemptSequence', 'actor', 'at'])
        || !readinessAttempts.some((entry) => isRecord(entry) && entry['branchPlanId'] === pointer['branchPlanId'] && entry['sequence'] === pointer['readinessAttemptSequence'])
      ) return false
    } else if (action === 'activate-render') {
      if (
        !hasOnlyKeys(pointer, ['sequence', 'action', 'renderIdentity', 'eventSequence', 'actor', 'at'])
        || !resolveRenderEvent(projection, pointer['renderIdentity'], pointer['eventSequence'])
      ) return false
    } else if (action === 'rollback-active' || action === 'select-success') {
      const event = resolveRenderEvent(projection, pointer['renderIdentity'], pointer['eventSequence'])
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

  const selected = projection['selectedSuccess']
  if (selected !== undefined) {
    if (
      !isRecord(selected)
      || !hasOnlyKeys(selected, ['renderIdentity', 'eventSequence', 'resultIdentity', 'audioRunId'])
    ) return false
    const selectedEvent = resolveRenderEvent(projection, selected['renderIdentity'], selected['eventSequence'])
    if (
      selectedEvent?.['status'] !== 'succeeded'
      || selectedEvent['providerRenderResultIdentity'] !== selected['resultIdentity']
      || selectedEvent['audioRunId'] !== selected['audioRunId']
      || !pointerEvents.some((pointer) =>
        isRecord(pointer)
        && (pointer['action'] === 'select-success' || pointer['action'] === 'rollback-active')
        && pointer['renderIdentity'] === selected['renderIdentity']
        && pointer['eventSequence'] === selected['eventSequence']
        && pointer['resultIdentity'] === selected['resultIdentity']
        && pointer['audioRunId'] === selected['audioRunId']
      )
    ) return false
  }

  const active = projection['activeWork']
  if (!isRecord(active)) return false
  const latestPointer = pointerEvents.at(-1)
  if (active['kind'] === 'branch') {
    if (
      !hasOnlyKeys(active, ['kind', 'branchPlanId', 'readinessAttemptSequence'])
      || typeof active['branchPlanId'] !== 'string'
      || !branchIds.has(active['branchPlanId'])
      || (active['readinessAttemptSequence'] !== undefined && !readinessAttempts.some((entry) =>
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
      !hasOnlyKeys(active, ['kind', 'renderIdentity', 'eventSequence'])
      || !resolveRenderEvent(projection, active['renderIdentity'], active['eventSequence'])
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
      || evidence['targetKey'] !== targetKey
      || (evidence['reasonCode'] !== 'user-requested' && evidence['reasonCode'] !== 'project-policy' && evidence['reasonCode'] !== 'rights-policy')
      || typeof evidence['reason'] !== 'string'
      || evidence['reason'].trim().length === 0
      || !isAuditActor(evidence['actor'])
      || !isIsoDateTime(evidence['at'])
      || branchHistory.length !== 0
      || readinessAttempts.length !== 0
      || renderHistory.length !== 0
      || selected !== undefined
      || !isRecord(latestPointer)
      || latestPointer['action'] !== 'activate-policy-skip'
      || latestPointer['skipId'] !== evidence['skipId']
    ) return false
  } else {
    return false
  }
  return true
}

const isAppendOnlyArray = (before: unknown[], after: unknown[]): boolean =>
  before.length <= after.length
  && before.every((entry, index) => canonicalManifestJson(entry) === canonicalManifestJson(after[index]))

const parseAudioProjectionStatus = (
  value: unknown,
  targetKey: string
): { status: PipelineProviderState['status'], attempts: number } | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['activeWork', 'selectedSuccess', 'branchHistory', 'readinessAttempts', 'renderHistory', 'pointerEvents'])
    || !isRecord(value['activeWork'])
    || !Array.isArray(value['branchHistory'])
    || !Array.isArray(value['readinessAttempts'])
    || !Array.isArray(value['renderHistory'])
    || !Array.isArray(value['pointerEvents'])
  ) {
    return undefined
  }
  if (!validateAudioProjectionStructure(value, targetKey)) {
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
    || !hasOnlyKeys(active, ['kind', 'renderIdentity', 'eventSequence'])
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

export const toManifestRelativePath = (
  rootDir: string,
  value: string
): string => {
  const root = resolve(rootDir)
  const target = isAbsolute(value) ? resolve(value) : resolve(root, value)
  const fromRoot = relative(root, target) || '.'
  if (!isSafeRelativePath(root, fromRoot)) {
    throw CLIUsageError(`Manifest path escapes its run root: ${value}`)
  }
  return fromRoot
}

export const resolveManifestRelativePath = (
  rootDir: string,
  value: string
): string => {
  if (!isSafeRelativePath(rootDir, value)) {
    throw CLIUsageError(`Manifest path escapes its run root: ${value}`)
  }
  return resolve(rootDir, value)
}

const parseProviderState = (
  rootDir: string,
  value: unknown
): PipelineProviderState | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['service', 'model', 'local', 'operation', 'targetKey', 'transport', 'artifactDir', 'status', 'attempts', 'options', 'metadata', 'result', 'error'])
    || typeof value['service'] !== 'string'
    || (value['model'] !== undefined && value['model'] !== null && typeof value['model'] !== 'string')
    || typeof value['artifactDir'] !== 'string'
    || !isSafeRelativePath(rootDir, value['artifactDir'])
    || typeof value['status'] !== 'string'
    || !PROVIDER_STATUS_SET.has(value['status'])
    || typeof value['attempts'] !== 'number'
    || !Number.isInteger(value['attempts'])
    || value['attempts'] < 0
    || !isRecord(value['options'])
    || !isRecord(value['metadata'])
    || (value['result'] !== undefined && !isRecord(value['result']))
    || (value['error'] !== undefined && !isRecord(value['error']))
    || (value['local'] !== undefined && typeof value['local'] !== 'boolean')
  ) {
    return undefined
  }

  const persistedAudioIdentityKeys = ['operation', 'targetKey', 'transport'].filter((key) => hasPersistedKey(value, key))
  if (persistedAudioIdentityKeys.length !== 0 && persistedAudioIdentityKeys.length !== 3) {
    return undefined
  }
  const operation = persistedAudioIdentityKeys.length === 3 ? value['operation'] : undefined
  const targetKey = persistedAudioIdentityKeys.length === 3 ? value['targetKey'] : undefined
  const transport = persistedAudioIdentityKeys.length === 3 ? value['transport'] : undefined
  if (
    persistedAudioIdentityKeys.length === 3
    && (
      typeof operation !== 'string'
      || operation.trim().length === 0
      || typeof targetKey !== 'string'
      || targetKey.trim().length === 0
      || typeof transport !== 'string'
      || transport.trim().length === 0
      || typeof value['model'] !== 'string'
      || targetKey !== canonicalTargetKey(operation, value['service'], value['model'], transport)
    )
  ) {
    return undefined
  }

  if (operation === 'tts-synthesis' || operation === 'comic-audio') {
    const expectedNamespace = operation === 'tts-synthesis' ? 'ttsAudio' : 'comicAudio'
    const forbiddenNamespace = operation === 'tts-synthesis' ? 'comicAudio' : 'ttsAudio'
    const result = value['result']
    const metadata = value['metadata']
    if (
      !isRecord(result)
      || !hasOnlyKeys(result, [expectedNamespace])
      || !isRecord(result[expectedNamespace])
      || result[forbiddenNamespace] !== undefined
      || !isRecord(metadata[expectedNamespace])
      || canonicalManifestJson(result[expectedNamespace]) !== canonicalManifestJson(metadata[expectedNamespace])
      || metadata[forbiddenNamespace] !== undefined
      || typeof targetKey !== 'string'
    ) {
      return undefined
    }
    const projected = parseAudioProjectionStatus(result[expectedNamespace], targetKey)
    if (!projected || projected.status !== value['status'] || projected.attempts !== value['attempts']) {
      return undefined
    }
  } else if (
    (isRecord(value['result']) && (value['result']['ttsAudio'] !== undefined || value['result']['comicAudio'] !== undefined))
    || value['metadata']['ttsAudio'] !== undefined
    || value['metadata']['comicAudio'] !== undefined
  ) {
    return undefined
  }

  return {
    service: value['service'],
    ...(value['model'] === null || typeof value['model'] === 'string' ? { model: value['model'] } : {}),
    ...(typeof value['local'] === 'boolean' ? { local: value['local'] } : {}),
    ...(typeof operation === 'string' ? { operation } : {}),
    ...(typeof targetKey === 'string' ? { targetKey } : {}),
    ...(typeof transport === 'string' ? { transport } : {}),
    artifactDir: value['artifactDir'],
    status: value['status'] as PipelineProviderState['status'],
    attempts: value['attempts'],
    options: value['options'],
    metadata: value['metadata'],
    ...(isRecord(value['result']) ? { result: value['result'] } : {}),
    ...(isRecord(value['error']) ? { error: value['error'] } : {})
  }
}

type ProjectionArtifactReference = {
  path: string
  sha256: string
  scope?: 'provider-artifact' | 'run-root' | undefined
  kind: 'audio' | 'strategy-text' | 'source-identity' | 'dialogue-plan' | 'capability-fixture' | 'branch-plan' | 'readiness-result' | 'render-plan' | 'admission-journal' | 'admission-evidence' | 'provider-render-result' | 'audio-run' | 'audio-mix-plan' | 'audio-transform-ledger' | 'final-timeline' | 'batch-invocation-plan' | 'provider-batch-result' | 'provider-timing-evidence' | 'cache-materialization-plan' | 'render-takes' | 'take-selection' | 'continuation-checkpoint' | 'consumed-selection-rebuild' | 'generic-json'
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

type ProjectionArtifactReferences = {
  files: ProjectionArtifactReference[]
  directories: string[]
}

const resolveArtifactRelativePath = (
  baseDir: string | undefined,
  value: unknown
): string | undefined => {
  if (!isStrictArtifactRelativePath(value)) return undefined
  if (!baseDir) return value
  if (!isStrictArtifactRelativePath(baseDir)) return undefined
  const combined = posix.join(baseDir, value)
  return isStrictArtifactRelativePath(combined) ? combined : undefined
}

const projectionArtifactReferenceKey = (reference: Pick<ProjectionArtifactReference, 'path' | 'scope'>): string =>
  `${reference.scope ?? 'provider-artifact'}\0${reference.path}`

const collectProjectionArtifactReferences = (
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
            } else if (slot['source'] === 'cache-materialization') {
              const plan = slot['materializationPlan']
              const result = slot['batchResult']
              if (
                !isRecord(plan)
                || !addFile(plan, 'path', 'sha256', 'cache-materialization-plan', undefined, rawRender['renderDir'] as string, { renderDir: rawRender['renderDir'] as string })
                || !isRecord(result)
                || !addFile(result, 'path', 'sha256', 'provider-batch-result', undefined, rawRender['renderDir'] as string, { renderDir: rawRender['renderDir'] as string })
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

const hasNoSymlinkBelowRoot = async (
  rootDir: string,
  candidate: string
): Promise<boolean> => {
  const fromRoot = relative(resolve(rootDir), resolve(candidate))
  if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) return false
  let current = resolve(rootDir)
  for (const segment of fromRoot.split(sep)) {
    current = join(current, segment)
    const entry = await lstat(current)
    if (entry.isSymbolicLink()) return false
  }
  return true
}

const validateProjectionArtifactJson = (
  kind: ProjectionArtifactReferences['files'][number]['kind'],
  value: Record<string, unknown>
): void => {
  if (kind === 'branch-plan') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Provider render branch plan requires schemaVersion 1.')
    assertContentIdentity(value, 'branchPlanId', 'Provider render branch plan')
    const branch = value as unknown as ProviderRenderBranchPlan
    if (
      branch.targetKey !== canonicalTargetKey(branch.operation, branch.provider, branch.model, branch.transport)
      || !Array.isArray(branch.candidateStrategies)
      || branch.candidateStrategies.length === 0
    ) {
      throw CLIUsageError('Provider render branch plan has an invalid target or no candidate strategy.')
    }
    for (const candidate of branch.candidateStrategies) {
      assertContentIdentity(candidate as unknown as Record<string, unknown>, 'candidateId', 'Provider render branch candidate')
      if (
        !Array.isArray(candidate.requiredCapabilityScopeHashes)
        || candidate.requiredCapabilityScopeHashes.length === 0
        || candidate.requiredCapabilityScopeHashes.some((hash) => !isSha256(hash))
        || !Array.isArray(candidate.batchSketches)
        || candidate.batchSketches.length === 0
        || !isSha256(candidate.requestedOutputHash)
      ) throw CLIUsageError('Provider render branch candidate has invalid capability, batch, or output evidence.')
    }
    return
  }
  if (kind === 'render-plan') {
    validateProviderRenderPlanIdentity(value as unknown as ProviderRenderPlan)
    return
  }
  if (kind === 'source-identity') {
    if (typeof value['canonicalPath'] === 'string') validateComicSourceIdentity(value as unknown as ComicSourceIdentity)
    else validateGenericTtsSourceIdentity(value as unknown as GenericTtsSourceIdentity)
    return
  }
  if (kind === 'dialogue-plan') {
    if (typeof value['sceneRunIdentity'] === 'string') validateComicDialoguePlan(value as unknown as ComicDialoguePlan)
    else validateGenericTtsDialoguePlan(value as unknown as GenericTtsDialoguePlan)
    return
  }
  if (kind === 'capability-fixture') {
    if (value['schemaVersion'] !== 1 || !Array.isArray(value['records']) || value['records'].length !== 1) {
      throw CLIUsageError('Provider capability fixture requires schemaVersion 1 and one exact capability record.')
    }
    validateCapabilityFacetSet(value['records'] as AnyCapabilityRecord[])
    const record = value['records'][0]
    if (
      !isRecord(record)
      || !isRecord(record['scope'])
      || value['capabilityFixtureHash'] !== hashCanonicalTtsValue({ schemaVersion: 1, records: value['records'] })
      || value['capabilityScopeHash'] !== hashCanonicalTtsValue(record['scope'])
    ) {
      throw CLIUsageError('Provider capability fixture has an invalid fixture or capability-scope identity.')
    }
    return
  }
  if (kind === 'readiness-result') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Provider readiness result requires schemaVersion 1.')
    assertContentIdentity(value, 'readinessResultHash', 'Provider readiness result')
    const readiness = value as unknown as ProviderReadinessResult
    if (
      !readiness.branchPlanId
      || !readiness.targetKey
      || (readiness.status !== 'ready' && readiness.status !== 'blocked')
      || !Array.isArray(readiness.capabilityObservations)
      || !Array.isArray(readiness.candidateReadiness)
      || !Array.isArray(readiness.resolvedVoices)
      || !Array.isArray(readiness.errors)
      || !isIsoDateTime(readiness.checkedAt)
    ) {
      throw CLIUsageError('Provider readiness result has an invalid identity, status, or evidence collection.')
    }
    const capabilityFixture = readiness.capabilityFixture
    if (
      capabilityFixture === undefined
      || !isSha256(capabilityFixture.capabilityFixtureHash)
      || !isStrictArtifactRelativePath(capabilityFixture.path)
      || !isSha256(capabilityFixture.sha256)
    ) {
      throw CLIUsageError('Provider readiness result requires an exact retained capability fixture reference.')
    }
    for (const observation of readiness.capabilityObservations) {
      validateAccountCapabilityObservation(observation)
    }
    return
  }
  if (kind === 'admission-journal') {
    validateRenderAdmissionJournalSnapshot(value as unknown as RenderAdmissionJournalSnapshot)
    return
  }
  if (kind === 'admission-evidence') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Sanitized admission evidence requires schemaVersion 1.')
    assertContentIdentity(value, 'evidenceHash', 'Sanitized admission evidence')
    if (
      typeof value['journalId'] !== 'string'
      || typeof value['invocationId'] !== 'string'
      || !Number.isInteger(value['requestOrdinal'])
      || !isSha256(value['requestFingerprint'])
      || !['acceptance', 'completion', 'rejection', 'ambiguity', 'not-admitted'].includes(value['evidenceKind'] as string)
      || !isIsoDateTime(value['observedAt'])
      || !isRecord(value['fields'])
    ) throw CLIUsageError('Sanitized admission evidence does not bind a complete request and proof kind.')
    return
  }
  if (kind === 'provider-render-result') {
    validateProviderRenderResult(value as unknown as ProviderRenderResult)
    return
  }
  if (kind === 'audio-run') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Audio run requires schemaVersion 1.')
    assertContentIdentity(value, 'audioRunId', 'Audio run')
    const audioRun = value as unknown as AudioRun
    if (!audioRun.targetKey || !audioRun.renderPlanId || !audioRun.renderIdentity || audioRun.finalOutputs.length === 0) {
      throw CLIUsageError('Audio run requires its target, render, and final output identities.')
    }
    return
  }
  if (kind === 'audio-mix-plan') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Audio mix plan requires schemaVersion 1.')
    assertContentIdentity(value, 'mixPlanId', 'Audio mix plan')
    if (typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['sources']) || !Array.isArray(value['operations']) || !isIsoDateTime(value['createdAt'])) {
      throw CLIUsageError('Audio mix plan has invalid render, source, operation, or creation evidence.')
    }
    return
  }
  if (kind === 'audio-transform-ledger') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Audio transform ledger requires schemaVersion 1.')
    assertContentIdentity(value, 'transformLedgerId', 'Audio transform ledger')
    if (typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['operations'])) {
      throw CLIUsageError('Audio transform ledger has invalid render or operation evidence.')
    }
    return
  }
  if (kind === 'final-timeline') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Final timeline requires schemaVersion 1.')
    assertContentIdentity(value, 'timelineId', 'Final timeline')
    if (typeof value['renderIdentity'] !== 'string' || !isRecord(value['timing']) || !Array.isArray(value['speechSources']) || !isRecord(value['transformLedgerRef'])) {
      throw CLIUsageError('Final timeline has invalid render, timing, source, or transform-ledger evidence.')
    }
    return
  }
  if (kind === 'batch-invocation-plan') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Provider batch invocation plan requires schemaVersion 1.')
    assertContentIdentity(value, 'batchInvocationPlanId', 'Provider batch invocation plan')
    const plan = value as unknown as ProviderBatchInvocationPlan
    if (!plan.renderPlanId || !plan.renderIdentity || !plan.invocationId || !plan.batchId || !plan.generationSlotId) {
      throw CLIUsageError('Provider batch invocation plan requires complete render, attempt, batch, and slot identity.')
    }
    return
  }
  if (kind === 'provider-batch-result') {
    validateProviderBatchResult(value as unknown as ProviderBatchResult)
    return
  }
  if (kind === 'provider-timing-evidence') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Provider timing evidence requires schemaVersion 1.')
    assertContentIdentity(value, 'timingEvidenceId', 'Provider timing evidence')
    if (typeof value['provider'] !== 'string' || typeof value['model'] !== 'string' || typeof value['providerTimeUnit'] !== 'string' || !isRecord(value['payload'])) {
      throw CLIUsageError('Provider timing evidence has invalid provider, model, unit, or payload fields.')
    }
    return
  }
  if (kind === 'cache-materialization-plan') {
    validateCacheMaterializationPlan(value as unknown as CacheMaterializationPlan)
    return
  }
  if (kind === 'render-takes') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Render takes artifact requires schemaVersion 1.')
    assertContentIdentity(value, 'renderTakesId', 'Render takes artifact')
    if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['generationSlots'])) {
      throw CLIUsageError('Render takes artifact has invalid render or generation-slot evidence.')
    }
    return
  }
  if (kind === 'take-selection') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Take selection requires schemaVersion 1.')
    assertContentIdentity(value, 'selectionId', 'Take selection')
    if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || typeof value['batchId'] !== 'string' || !Array.isArray(value['batchResults'])) {
      throw CLIUsageError('Take selection has invalid render, batch, or result evidence.')
    }
    return
  }
  if (kind === 'continuation-checkpoint') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Continuation checkpoint requires schemaVersion 1.')
    assertContentIdentity(value, 'checkpointId', 'Continuation checkpoint')
    if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !isRecord(value['batchResult']) || !isRecord(value['selection'])) {
      throw CLIUsageError('Continuation checkpoint has invalid render, result, or selection evidence.')
    }
    return
  }
  if (kind === 'consumed-selection-rebuild') {
    if (value['schemaVersion'] !== 1) throw CLIUsageError('Consumed-selection rebuild authorization requires schemaVersion 1.')
    assertContentIdentity(value, 'authorizationId', 'Consumed-selection rebuild authorization')
    if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['authorizedPotentialDispatchSlots'])) {
      throw CLIUsageError('Consumed-selection rebuild authorization has invalid render or slot evidence.')
    }
  }
}

const createNestedArtifactReference = (
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

const isOpaqueProtectedAssetRef = (value: unknown): boolean =>
  isRecord(value)
  && typeof value['storeId'] === 'string'
  && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value['storeId'])
  && typeof value['assetId'] === 'string'
  && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value['assetId'])
  && isSha256(value['sha256'])

const collectNestedProjectionArtifactReferences = (
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

  const renderDir = reference.context?.renderDir
  if (reference.kind === 'readiness-result') {
    const fixture = value['capabilityFixture']
    if (
      !isRecord(fixture)
      || !add(fixture, 'path', 'sha256', 'capability-fixture', undefined, {
        capabilityFixtureHash: fixture['capabilityFixtureHash'] as string
      })
    ) return undefined
    return nested
  }

  if (reference.kind === 'render-plan' || reference.kind === 'branch-plan') {
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
      // Hybrid repair points into a separately retained source render. Until that source-root
      // binding is present in the canonical projection, accepting the path would be unverifiable.
      return undefined
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
      ) return undefined
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
      ) return undefined
      const allArtifacts = [strategy['sourceIdentity'], strategy['dialoguePlan'], strategy['normalizedDialogue'], ...turnArtifacts, ...slotArtifacts]
      const artifactPaths = allArtifacts.flatMap((artifact) => isRecord(artifact) && typeof artifact['path'] === 'string' ? [artifact['path']] : [])
      if (artifactPaths.length !== allArtifacts.length || new Set(artifactPaths).size !== artifactPaths.length) return undefined
      if (!add(strategy['sourceIdentity'], 'path', 'sha256', 'source-identity', renderDir, { identityHash: value['sourceIdentityHash'] as string }, { renderDir })) return undefined
      if (!add(strategy['dialoguePlan'], 'path', 'sha256', 'dialogue-plan', renderDir, { dialoguePlanId: value['dialoguePlanId'] as string }, { renderDir })) return undefined
      if (!add(strategy['normalizedDialogue'], 'path', 'sha256', 'strategy-text', renderDir, undefined, { renderDir })) return undefined
      for (const [index, rawArtifact] of turnArtifacts.entries()) {
        const plannedTurn = plannedTurns[index]
        if (!isRecord(rawArtifact) || !isRecord(plannedTurn) || typeof plannedTurn['canonicalText'] !== 'string') return undefined
        const expectedSha = createHash('sha256').update(plannedTurn['canonicalText'].endsWith('\n') ? plannedTurn['canonicalText'] : `${plannedTurn['canonicalText']}\n`).digest('hex')
        if (rawArtifact['sha256'] !== expectedSha || !add(rawArtifact, 'path', 'sha256', 'strategy-text', renderDir, undefined, { renderDir })) return undefined
      }
      for (const rawArtifact of slotArtifacts) {
        if (!isRecord(rawArtifact) || !add(rawArtifact, 'path', 'sha256', 'strategy-text', renderDir, undefined, { renderDir })) return undefined
      }
    }
    return nested
  }

  if (reference.kind === 'admission-journal') {
    const attemptDir = posix.dirname(reference.path)
    if (attemptDir === '.' || !renderDir || !Array.isArray(value['requests']) || !Array.isArray(value['recordedBatchResults'])) return undefined
    const context = { renderDir, attemptDir }
    for (const rawRequest of value['requests']) {
      if (!isRecord(rawRequest) || !add(rawRequest, 'batchInvocationPlanRef', 'batchInvocationPlanSha256', 'batch-invocation-plan', attemptDir, {
        batchInvocationPlanId: rawRequest['batchInvocationPlanId'] as string,
        renderPlanId: value['renderPlanId'] as string,
        renderIdentity: value['renderIdentity'] as string,
        invocationId: value['invocationId'] as string,
        batchId: rawRequest['batchId'] as string,
        generationSlotId: rawRequest['generationSlotId'] as string
      }, context)) return undefined
      if (!Array.isArray(rawRequest['transitions'])) return undefined
      for (const rawTransition of rawRequest['transitions']) {
        if (!isRecord(rawTransition)) return undefined
        const proof = rawTransition['evidence']
        if (proof === undefined) continue
        if (!isRecord(proof)) return undefined
        if (proof['kind'] === 'protected-asset') {
          if (!isOpaqueProtectedAssetRef(proof['asset'])) return undefined
          continue
        }
        if (proof['kind'] !== 'sanitized-artifact' || !add(proof, 'path', 'sha256', 'admission-evidence', attemptDir, {
          journalId: value['journalId'] as string,
          invocationId: value['invocationId'] as string,
          requestOrdinal: rawRequest['requestOrdinal'] as number,
          requestFingerprint: rawRequest['requestFingerprint'] as string,
          evidenceKind: proof['proofKind'] as string
        }, context)) return undefined
      }
    }
    for (const rawResult of value['recordedBatchResults']) {
      if (!isRecord(rawResult) || !add(rawResult, 'batchResultRef', 'batchResultSha256', 'provider-batch-result', attemptDir, {
        batchResultId: rawResult['batchResultId'] as string,
        renderPlanId: value['renderPlanId'] as string,
        renderIdentity: value['renderIdentity'] as string,
        batchId: rawResult['batchId'] as string,
        generationSlotId: rawResult['generationSlotId'] as string
      }, context)) return undefined
    }
    const recordedResult = value['recordedResult']
    if (recordedResult !== undefined && (!isRecord(recordedResult) || !add(recordedResult, 'resultRef', 'resultSha256', 'provider-render-result', attemptDir, {
      resultIdentity: recordedResult['resultIdentity'] as string,
      renderPlanId: value['renderPlanId'] as string,
      renderIdentity: value['renderIdentity'] as string
    }, { ...context, eventJournalSnapshotId: value['snapshotId'] as string }))) return undefined
    const rebuild = value['consumedSelectionRebuild']
    if (rebuild !== undefined && (!isRecord(rebuild) || !add(rebuild, 'artifactRef', 'sha256', 'consumed-selection-rebuild', renderDir, {
      authorizationId: rebuild['authorizationId'] as string
    }, context))) return undefined
    return nested
  }

  if (reference.kind === 'provider-render-result') {
    if (!renderDir || !Array.isArray(value['batchResults'])) return undefined
    for (const rawResult of value['batchResults']) {
      if (!isRecord(rawResult) || !add(rawResult, 'artifactRef', 'sha256', 'provider-batch-result', renderDir, {
        batchResultId: rawResult['batchResultId'] as string,
        renderPlanId: value['renderPlanId'] as string,
        renderIdentity: value['renderIdentity'] as string,
        batchId: rawResult['batchId'] as string,
        generationSlotId: rawResult['generationSlotId'] as string
      }, { renderDir })) return undefined
    }
    const renderTakes = value['renderTakesArtifact']
    if (renderTakes !== undefined && (!isRecord(renderTakes) || !add(renderTakes, 'artifactRef', 'sha256', 'render-takes', renderDir, {
      renderTakesId: renderTakes['renderTakesId'] as string,
      renderPlanId: value['renderPlanId'] as string,
      renderIdentity: value['renderIdentity'] as string
    }, { renderDir }))) return undefined
    return nested
  }

  if (reference.kind === 'provider-batch-result') {
    const marker = '/batch-results/'
    const markerIndex = reference.path.indexOf(marker)
    const attemptDir = reference.context?.attemptDir ?? (markerIndex > 0 ? reference.path.slice(0, markerIndex) : undefined)
    const batchResultDir = posix.dirname(reference.path)
    if (!renderDir || batchResultDir === '.' || !Array.isArray(value['outputs'])) return undefined
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
      ) return undefined
    }
    for (const rawOutput of value['outputs']) {
      if (!isRecord(rawOutput) || !add(rawOutput, 'artifactRef', 'sha256', 'audio', batchResultDir, undefined, context)) return undefined
    }
    const generated = value['generatedBatch']
    if (generated !== undefined) {
      if (!isRecord(generated) || !Array.isArray(generated['takes'])) return undefined
      for (const rawTake of generated['takes']) {
        if (!isRecord(rawTake) || !isRecord(rawTake['audio']) || !add(rawTake['audio'], 'artifactRef', 'sha256', 'audio', batchResultDir, undefined, context)) return undefined
        const timing = rawTake['rawProviderTimingEvidenceRef']
        if (timing !== undefined && (!isRecord(timing) || !add(timing, 'path', 'sha256', 'provider-timing-evidence', batchResultDir, {
          timingEvidenceId: timing['timingEvidenceId'] as string
        }, context))) return undefined
        const continuation = rawTake['continuationCandidate']
        if (isRecord(continuation) && continuation['kind'] === 'protected-token' && !isOpaqueProtectedAssetRef(continuation['asset'])) return undefined
      }
    }
    const cache = value['cacheMaterialization']
    if (cache !== undefined) {
      if (!isRecord(cache) || !isRecord(cache['materializationPlan']) || !add(cache['materializationPlan'], 'artifactRef', 'sha256', 'cache-materialization-plan', renderDir, {
        cacheMaterializationPlanId: cache['materializationPlan']['cacheMaterializationPlanId'] as string
      }, context)) return undefined
      for (const key of ['cacheEntry', 'sourceBatchResult', 'sourceProvenanceAttestation'] as const) {
        const copy = cache[key]
        if (!isRecord(copy) || !add(copy, 'artifactRef', 'sha256', 'generic-json', batchResultDir, undefined, context)) return undefined
      }
      if (!Array.isArray(cache['materializedObjects'])) return undefined
      for (const rawObject of cache['materializedObjects']) {
        if (!isRecord(rawObject) || !isRecord(rawObject['source'])) return undefined
        const kind = rawObject['source']['role'] === 'audio' ? 'audio' : rawObject['source']['role'] === 'timing-evidence' ? 'provider-timing-evidence' : 'generic-json'
        if (!add(rawObject, 'artifactRef', 'sha256', kind, batchResultDir, undefined, context)) return undefined
      }
    }
    return nested
  }

  if (reference.kind === 'batch-invocation-plan') {
    const continuation = value['resolvedContinuation']
    if (!isRecord(continuation)) return undefined
    if (continuation['kind'] === 'checkpoint') {
      if (continuation['source'] !== 'prior-batch' || !renderDir || !add(continuation, 'checkpointRef', 'checkpointSha256', 'continuation-checkpoint', renderDir, {
        checkpointId: continuation['checkpointId'] as string
      }, { renderDir })) return undefined
      if (isRecord(continuation['continuationState']) && continuation['continuationState']['kind'] === 'protected-token' && !isOpaqueProtectedAssetRef(continuation['continuationState']['asset'])) return undefined
    } else if (continuation['kind'] !== 'none') {
      return undefined
    }
    return nested
  }

  if (reference.kind === 'audio-run') {
    const audioRunDir = posix.dirname(reference.path)
    if (!renderDir || audioRunDir === '.') return undefined
    const context = { renderDir, audioRunDir }
    const providerResult = value['providerResult']
    if (!isRecord(providerResult) || !add(providerResult, 'path', 'sha256', 'provider-render-result', renderDir, {
      resultIdentity: providerResult['resultIdentity'] as string,
      renderPlanId: value['renderPlanId'] as string,
      renderIdentity: value['renderIdentity'] as string
    }, context)) return undefined
    const renderTakes = value['renderTakes']
    if (renderTakes !== undefined && (!isRecord(renderTakes) || !add(renderTakes, 'path', 'sha256', 'render-takes', renderDir, {
      renderTakesId: renderTakes['renderTakesId'] as string
    }, context))) return undefined
    for (const [key, kind] of [['takeSelections', 'take-selection'], ['continuationCheckpoints', 'continuation-checkpoint']] as const) {
      const list = value[key]
      if (!Array.isArray(list)) return undefined
      for (const item of list) if (!isRecord(item) || !add(item, 'path', 'sha256', kind, renderDir, undefined, context)) return undefined
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
      }, context)) return undefined
    }
    if (!Array.isArray(value['finalOutputs'])) return undefined
    for (const output of value['finalOutputs']) if (!isRecord(output) || !add(output, 'path', 'sha256', 'audio', audioRunDir, undefined, context)) return undefined
    return nested
  }

  if (reference.kind === 'final-timeline') {
    const ledger = value['transformLedgerRef']
    const audioRunDir = reference.context?.audioRunDir
    if (!audioRunDir || !isRecord(ledger) || !add(ledger, 'path', 'sha256', 'audio-transform-ledger', audioRunDir, {
      renderIdentity: value['renderIdentity'] as string
    }, reference.context)) return undefined
    return nested
  }

  if (reference.kind === 'render-takes') {
    if (!renderDir || !Array.isArray(value['generationSlots'])) return undefined
    for (const slot of value['generationSlots']) {
      if (!isRecord(slot) || !isRecord(slot['batchResult']) || !add(slot['batchResult'], 'artifactRef', 'sha256', 'provider-batch-result', renderDir, {
        batchResultId: slot['batchResult']['batchResultId'] as string
      }, { renderDir })) return undefined
    }
    return nested
  }

  if (reference.kind === 'take-selection') {
    if (!renderDir || !Array.isArray(value['batchResults'])) return undefined
    for (const result of value['batchResults']) if (!isRecord(result) || !add(result, 'artifactRef', 'sha256', 'provider-batch-result', renderDir, {
      batchResultId: result['batchResultId'] as string
    }, { renderDir })) return undefined
    return nested
  }

  if (reference.kind === 'continuation-checkpoint') {
    const result = value['batchResult']
    const selection = value['selection']
    if (
      !renderDir
      || !isRecord(result)
      || !add(result, 'artifactRef', 'sha256', 'provider-batch-result', renderDir, { batchResultId: result['batchResultId'] as string }, { renderDir })
      || !isRecord(selection)
      || !add(selection, 'path', 'sha256', 'take-selection', renderDir, { selectionId: selection['selectionId'] as string }, { renderDir })
    ) return undefined
    const state = value['continuationState']
    if (isRecord(state) && state['kind'] === 'protected-token' && !isOpaqueProtectedAssetRef(state['asset'])) return undefined
    return nested
  }

  return nested
}

const discoverPreviousAdmissionJournalReference = async (
  artifactRoot: string,
  reference: ProjectionArtifactReference,
  snapshot: Record<string, unknown>
): Promise<ProjectionArtifactReference[]> => {
  const previousSnapshotId = snapshot['previousSnapshotId']
  if (previousSnapshotId === undefined) return []
  if (typeof previousSnapshotId !== 'string' || previousSnapshotId.length === 0) {
    throw CLIUsageError('Admission journal predecessor ID is invalid.')
  }
  const attemptDir = posix.dirname(reference.path)
  if (attemptDir === '.' || !isStrictArtifactRelativePath(attemptDir)) {
    throw CLIUsageError('Admission journal is not contained by a stable attempt directory.')
  }
  const absoluteAttemptDir = resolve(artifactRoot, attemptDir)
  if (!isSafeRelativePath(artifactRoot, attemptDir) || !await hasNoSymlinkBelowRoot(artifactRoot, absoluteAttemptDir)) {
    throw CLIUsageError('Admission journal attempt directory is unsafe.')
  }
  const matches: ProjectionArtifactReference[] = []
  for (const entry of await readdir(absoluteAttemptDir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.json')) continue
    const candidatePath = posix.join(attemptDir, entry.name)
    if (candidatePath === reference.path || !isStrictArtifactRelativePath(candidatePath)) continue
    const absoluteCandidate = resolve(artifactRoot, candidatePath)
    if (!await hasNoSymlinkBelowRoot(artifactRoot, absoluteCandidate)) continue
    const bytes = await readFile(absoluteCandidate)
    let candidate: unknown
    try {
      candidate = JSON.parse(bytes.toString('utf8')) as unknown
    } catch {
      continue
    }
    if (
      !isRecord(candidate)
      || candidate['snapshotId'] !== previousSnapshotId
      || candidate['journalId'] !== snapshot['journalId']
    ) continue
    matches.push({
      path: candidatePath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      kind: 'admission-journal',
      expectedJsonFields: {
        snapshotId: previousSnapshotId,
        journalId: snapshot['journalId'] as string,
        renderPlanId: snapshot['renderPlanId'] as string,
        renderIdentity: snapshot['renderIdentity'] as string
      },
      ...(reference.context ? { context: reference.context } : {})
    })
  }
  if (matches.length !== 1) {
    throw CLIUsageError('Admission journal predecessor must resolve exactly once inside the same attempt directory.')
  }
  return matches
}

const validateProjectionArtifactGraphLinks = (
  references: readonly ProjectionArtifactReference[],
  checked: ReadonlyMap<string, { sha256: string, json?: Record<string, unknown> | undefined }>
): boolean => {
  const referencesForKind = (kind: ProjectionArtifactReference['kind']) => references.filter((reference) => reference.kind === kind)
  const checkedReference = (reference: ProjectionArtifactReference) => checked.get(projectionArtifactReferenceKey(reference))
  const checkedProviderPath = (path: string) => checked.get(`provider-artifact\0${path}`)
  const jsonAt = (reference: ProjectionArtifactReference): Record<string, unknown> | undefined => checkedReference(reference)?.json
  const capabilityFixtures = new Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>()
  for (const reference of referencesForKind('capability-fixture')) {
    const value = jsonAt(reference)
    const fixtureHash = value?.['capabilityFixtureHash']
    if (!value || typeof fixtureHash !== 'string') return false
    const prior = capabilityFixtures.get(fixtureHash)
    if (prior && (prior.reference.path !== reference.path || prior.reference.sha256 !== reference.sha256 || canonicalManifestJson(prior.value) !== canonicalManifestJson(value))) return false
    capabilityFixtures.set(fixtureHash, { reference, value })
  }
  const branchPlansById = new Map<string, Record<string, unknown>>()
  for (const reference of referencesForKind('branch-plan')) {
    const value = jsonAt(reference)
    const branchPlanId = value?.['branchPlanId']
    if (!value || typeof branchPlanId !== 'string') return false
    const prior = branchPlansById.get(branchPlanId)
    if (prior && canonicalManifestJson(prior) !== canonicalManifestJson(value)) return false
    branchPlansById.set(branchPlanId, value)
  }
  const renderPlansByCandidate = new Map<string, Record<string, unknown>>()
  const renderPlansById = new Map<string, Record<string, unknown>>()
  for (const reference of referencesForKind('render-plan')) {
    const value = jsonAt(reference)
    const candidateId = value?.['branchCandidateId']
    const branchPlanId = value?.['branchPlanId']
    const renderPlanId = value?.['renderPlanId']
    if (!value || typeof candidateId !== 'string' || typeof branchPlanId !== 'string' || typeof renderPlanId !== 'string') return false
    const candidateKey = `${branchPlanId}\0${candidateId}`
    const prior = renderPlansByCandidate.get(candidateKey)
    if (prior && canonicalManifestJson(prior) !== canonicalManifestJson(value)) return false
    renderPlansByCandidate.set(candidateKey, value)
    const priorPlan = renderPlansById.get(renderPlanId)
    if (priorPlan && canonicalManifestJson(priorPlan) !== canonicalManifestJson(value)) return false
    renderPlansById.set(renderPlanId, value)
  }
  const canonicalTurnFromRenderPlan = (turn: Record<string, unknown>): Record<string, unknown> => ({
    turnId: turn['turnId'],
    sourceSegmentId: turn['sourceSegmentId'],
    ...(turn['beatIndex'] !== undefined ? { beatIndex: turn['beatIndex'] } : {}),
    subjectKey: turn['subjectKey'],
    originalSpeakerLabel: turn['originalSpeakerLabel'],
    canonicalText: turn['canonicalText'],
    ...(turn['sourceSpans'] !== undefined ? { sourceSpans: turn['sourceSpans'] } : {}),
    ...(turn['delivery'] !== undefined ? { delivery: turn['delivery'] } : {}),
    ...(turn['effect'] !== undefined ? { effect: turn['effect'] } : {})
  })
  for (const reference of referencesForKind('render-plan')) {
    const value = jsonAt(reference)
    const renderDir = reference.context?.renderDir
    const strategy = value?.['strategyArtifacts']
    if (!value || !renderDir || !isRecord(strategy) || !isRecord(strategy['sourceIdentity']) || !isRecord(strategy['dialoguePlan']) || !Array.isArray(value['nodes'])) return false
    const sourcePath = resolveArtifactRelativePath(renderDir, strategy['sourceIdentity']['path'])
    const dialoguePath = resolveArtifactRelativePath(renderDir, strategy['dialoguePlan']['path'])
    const source = sourcePath ? checkedProviderPath(sourcePath)?.json : undefined
    const dialogue = dialoguePath ? checkedProviderPath(dialoguePath)?.json : undefined
    const canonicalNodes: unknown[] = []
    for (const node of value['nodes']) {
      if (!isRecord(node)) continue
      if (node['kind'] === 'turn' && isRecord(node['turn'])) {
        canonicalNodes.push({ kind: 'turn', turn: canonicalTurnFromRenderPlan(node['turn']) })
      } else if (node['kind'] === 'overlap' && typeof node['groupId'] === 'string' && Array.isArray(node['turns']) && node['turns'].every(isRecord)) {
        canonicalNodes.push({ kind: 'overlap', groupId: node['groupId'], turns: node['turns'].map((turn) => canonicalTurnFromRenderPlan(turn as Record<string, unknown>)) })
      }
    }
    if (
      !source
      || !dialogue
      || source['identityHash'] !== value['sourceIdentityHash']
      || dialogue['dialoguePlanId'] !== value['dialoguePlanId']
      || canonicalManifestJson(dialogue['sourceIdentity']) !== canonicalManifestJson(source)
      || canonicalManifestJson(dialogue['nodes']) !== canonicalManifestJson(canonicalNodes)
    ) return false
  }
  for (const reference of referencesForKind('readiness-result')) {
    const value = jsonAt(reference)
    const fixtureRef = value?.['capabilityFixture']
    if (!value || !isRecord(fixtureRef) || typeof fixtureRef['capabilityFixtureHash'] !== 'string') return false
    const fixture = capabilityFixtures.get(fixtureRef['capabilityFixtureHash'])
    const fixturePath = resolveArtifactRelativePath(undefined, fixtureRef['path'])
    if (
      !fixture
      || !fixturePath
      || fixture.reference.path !== fixturePath
      || fixture.reference.sha256 !== fixtureRef['sha256']
      || fixture.value['capabilityFixtureHash'] !== fixtureRef['capabilityFixtureHash']
      || typeof fixture.value['capabilityScopeHash'] !== 'string'
      || !Array.isArray(value['capabilityObservations'])
    ) return false
    const capabilityScopeHash = fixture.value['capabilityScopeHash'] as string
    const observationsByHash = new Map<string, Record<string, unknown>>()
    for (const rawObservation of value['capabilityObservations']) {
      if (!isRecord(rawObservation)) return false
      validateAccountCapabilityObservation(rawObservation as unknown as AccountCapabilityObservation, {
        capabilityScopeHash,
        capabilityFixtureHash: fixtureRef['capabilityFixtureHash']
      })
      const observationHash = rawObservation['observationHash']
      if (typeof observationHash !== 'string' || observationsByHash.has(observationHash)) return false
      observationsByHash.set(observationHash, rawObservation)
    }
    const branchPlan = typeof value['branchPlanId'] === 'string' ? branchPlansById.get(value['branchPlanId']) : undefined
    if (!branchPlan || branchPlan['capabilityFixtureHash'] !== fixtureRef['capabilityFixtureHash']) return false
    if (!Array.isArray(value['candidateReadiness']) || !Array.isArray(branchPlan['candidateStrategies'])) return false
    const branchCandidateEntries = branchPlan['candidateStrategies']
    const readinessCandidates = value['candidateReadiness']
    if (readinessCandidates.length !== branchCandidateEntries.length) return false
    let readyCandidateCount = 0
    const seenCandidateIds = new Set<string>()
    for (let index = 0; index < branchCandidateEntries.length; index += 1) {
      const branchCandidate = branchCandidateEntries[index]
      const readinessCandidate = readinessCandidates[index]
      if (!isRecord(branchCandidate) || !isRecord(readinessCandidate)) return false
      const branchCandidateId = branchCandidate['candidateId']
      if (
        typeof branchCandidateId !== 'string'
        || seenCandidateIds.has(branchCandidateId)
        || readinessCandidate['candidateId'] !== branchCandidateId
        || readinessCandidate['strategy'] !== branchCandidate['strategy']
        || canonicalManifestJson(readinessCandidate['requiredCapabilityScopeHashes']) !== canonicalManifestJson(branchCandidate['requiredCapabilityScopeHashes'])
        || !Array.isArray(readinessCandidate['accountObservationHashes'])
        || !Array.isArray(readinessCandidate['errors'])
      ) return false
      seenCandidateIds.add(branchCandidateId)
      const requiredScopes = Array.isArray(branchCandidate['requiredCapabilityScopeHashes'])
        ? branchCandidate['requiredCapabilityScopeHashes']
        : []
      const expectedObservationHashes = [...observationsByHash.values()]
        .filter((observation) => requiredScopes.includes(observation['capabilityScopeHash']))
        .map((observation) => observation['observationHash'] as string)
        .sort((left, right) => left.localeCompare(right))
      const actualObservationHashes = [...readinessCandidate['accountObservationHashes']]
      if (
        canonicalManifestJson(actualObservationHashes) !== canonicalManifestJson(expectedObservationHashes)
        || new Set(actualObservationHashes).size !== actualObservationHashes.length
      ) return false
      const observationsAvailable = expectedObservationHashes.length === requiredScopes.length
        && expectedObservationHashes.every((hash) => observationsByHash.get(hash)?.['state'] === 'available')
      const candidateReady = readinessCandidate['status'] === 'ready'
      if (
        (readinessCandidate['status'] !== 'ready' && readinessCandidate['status'] !== 'blocked')
        || candidateReady !== (observationsAvailable && readinessCandidate['errors'].length === 0)
      ) return false
      if (candidateReady) readyCandidateCount += 1
    }
    if (
      (value['status'] === 'ready') !== (readyCandidateCount > 0)
      || (value['status'] === 'ready' && (value['errors'] as unknown[]).length !== 0)
      || (value['status'] === 'blocked' && (value['errors'] as unknown[]).length === 0)
    ) return false
    const candidateId = reference.context?.branchCandidateId
    if (!candidateId) continue
    const renderPlan = renderPlansByCandidate.get(`${value['branchPlanId']}\0${candidateId}`)
    if (!renderPlan) return false
    const candidates = value['candidateReadiness'].filter((candidate) => isRecord(candidate) && candidate['candidateId'] === candidateId)
    const candidate = candidates[0]
    const branchCandidates = branchPlan['candidateStrategies'].filter((entry) => isRecord(entry) && entry['candidateId'] === candidateId)
    const branchCandidate = branchCandidates[0]
    const expectedBatchSketches = Array.isArray(renderPlan['batches'])
      ? renderPlan['batches'].map((batch) => isRecord(batch) ? {
          orderedTurnIds: batch['orderedTurnIds'],
          requestControlsHash: hashCanonicalTtsValue(batch['requestControls']),
          generationSlots: Array.isArray(batch['generationSlots']) ? batch['generationSlots'].map((slot) => isRecord(slot) ? {
            slotIndex: slot['slotIndex'],
            requestedTakeCount: slot['requestedTakeCount'],
            plannedCost: slot['plannedCost']
          } : slot) : batch['generationSlots'],
          takeSelectionPolicy: batch['takeSelectionPolicy'],
          continuationPlanHash: hashCanonicalTtsValue(batch['continuation'])
        } : batch)
      : undefined
    if (
      candidates.length !== 1
      || !isRecord(candidate)
      || branchCandidates.length !== 1
      || !isRecord(branchCandidate)
      || candidate['status'] !== 'ready'
      || candidate['strategy'] !== renderPlan['strategy']
      || canonicalManifestJson(candidate['accountObservationHashes']) !== canonicalManifestJson(reference.context?.accountObservationHashes)
      || canonicalManifestJson(candidate['requiredCapabilityScopeHashes']) !== canonicalManifestJson(renderPlan['requiredCapabilityScopeHashes'])
      || renderPlan['branchPlanId'] !== branchPlan['branchPlanId']
      || renderPlan['dialoguePlanId'] !== branchPlan['dialoguePlanId']
      || renderPlan['sourceIdentityHash'] !== branchPlan['sourceIdentityHash']
      || renderPlan['targetKey'] !== branchPlan['targetKey']
      || renderPlan['provider'] !== branchPlan['provider']
      || renderPlan['model'] !== branchPlan['model']
      || renderPlan['transport'] !== branchPlan['transport']
      || renderPlan['voiceContextKey'] !== branchPlan['voiceContextKey']
      || canonicalManifestJson(renderPlan['voiceContext']) !== canonicalManifestJson(branchPlan['voiceContext'])
      || renderPlan['synthesisSettingsHash'] !== branchPlan['synthesisSettingsHash']
      || renderPlan['outputProfileHash'] !== branchPlan['outputProfileHash']
      || renderPlan['capabilityFixtureHash'] !== fixtureRef['capabilityFixtureHash']
      || canonicalManifestJson(renderPlan['requiredCapabilityScopeHashes']) !== canonicalManifestJson([capabilityScopeHash])
      || branchCandidate['strategy'] !== renderPlan['strategy']
      || canonicalManifestJson(branchCandidate['requiredCapabilityScopeHashes']) !== canonicalManifestJson(renderPlan['requiredCapabilityScopeHashes'])
      || branchCandidate['requestedOutputHash'] !== renderPlan['outputProfileHash']
      || canonicalManifestJson(branchCandidate['plannedCost']) !== canonicalManifestJson(renderPlan['plannedCost'])
      || canonicalManifestJson(branchCandidate['batchSketches']) !== canonicalManifestJson(expectedBatchSketches)
    ) return false
    const observationHashes = Array.isArray(value['capabilityObservations'])
      ? value['capabilityObservations'].flatMap((observation) => isRecord(observation) && typeof observation['observationHash'] === 'string' ? [observation['observationHash']] : [])
      : []
    if (
      canonicalManifestJson(candidate['accountObservationHashes']) !== canonicalManifestJson(observationHashes)
      || (reference.context?.accountObservationHashes ?? []).some((hash) => !observationHashes.includes(hash))
    ) return false
  }
  const batchResults = new Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>()
  for (const reference of referencesForKind('provider-batch-result')) {
    const value = jsonAt(reference)
    const batchResultId = value?.['batchResultId']
    if (!value || typeof batchResultId !== 'string') return false
    const prior = batchResults.get(batchResultId)
    if (prior && (prior.reference.path !== reference.path || prior.reference.sha256 !== reference.sha256)) return false
    batchResults.set(batchResultId, { reference, value })
  }

  const resolveFrom = (baseDir: string | undefined, path: unknown): string | undefined => resolveArtifactRelativePath(baseDir, path)
  const batchOutput = (
    batchResultId: unknown,
    outputId: unknown
  ): { batch: { reference: ProjectionArtifactReference, value: Record<string, unknown> }, output: Record<string, unknown> } | undefined => {
    if (typeof batchResultId !== 'string' || typeof outputId !== 'string') return undefined
    const batch = batchResults.get(batchResultId)
    if (!batch || !Array.isArray(batch.value['outputs'])) return undefined
    const matches = batch.value['outputs'].filter((output) => isRecord(output) && output['outputId'] === outputId)
    return matches.length === 1 ? { batch, output: matches[0] as Record<string, unknown> } : undefined
  }

  for (const reference of referencesForKind('provider-render-result')) {
    const value = jsonAt(reference)
    const renderDir = reference.context?.renderDir
    if (!value || !renderDir || !Array.isArray(value['batchResults']) || !Array.isArray(value['outputs'])) return false
    const renderPlan = typeof value['renderPlanId'] === 'string' ? renderPlansById.get(value['renderPlanId']) : undefined
    if (!renderPlan || !Array.isArray(renderPlan['batches']) || !Array.isArray(renderPlan['nodes'])) return false
    const plannedTurns = renderPlan['nodes'].flatMap((node) => {
      if (!isRecord(node)) return []
      if (node['kind'] === 'turn' && isRecord(node['turn']) && typeof node['turn']['turnId'] === 'string') return [node['turn']['turnId']]
      if (node['kind'] === 'overlap' && Array.isArray(node['turns'])) {
        return node['turns'].flatMap((turn) => isRecord(turn) && typeof turn['turnId'] === 'string' ? [turn['turnId']] : [])
      }
      return []
    })
    if (canonicalManifestJson(value['requestedTurnIds']) !== canonicalManifestJson(plannedTurns)) return false
    const plannedSlots = new Map<string, { batchId: string, generationSlotId: string, orderedTurnIds: string[] }>()
    for (const rawBatch of renderPlan['batches']) {
      if (!isRecord(rawBatch) || typeof rawBatch['batchId'] !== 'string' || !Array.isArray(rawBatch['orderedTurnIds']) || !Array.isArray(rawBatch['generationSlots'])) return false
      for (const rawSlot of rawBatch['generationSlots']) {
        if (!isRecord(rawSlot) || typeof rawSlot['generationSlotId'] !== 'string') return false
        const key = `${rawBatch['batchId']}\0${rawSlot['generationSlotId']}`
        if (plannedSlots.has(key)) return false
        plannedSlots.set(key, {
          batchId: rawBatch['batchId'],
          generationSlotId: rawSlot['generationSlotId'],
          orderedTurnIds: rawBatch['orderedTurnIds'] as string[]
        })
      }
    }
    const aggregatePairs: string[] = []
    const aggregateBatches: Array<Record<string, unknown>> = []
    for (const rawResult of value['batchResults']) {
      if (!isRecord(rawResult) || typeof rawResult['batchResultId'] !== 'string') return false
      const batch = batchResults.get(rawResult['batchResultId'])
      const expectedPath = resolveFrom(renderDir, rawResult['artifactRef'])
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
      ) return false
      aggregatePairs.push(pair)
      aggregateBatches.push(batch.value)
    }
    if (new Set(aggregatePairs).size !== aggregatePairs.length) return false
    const aggregatePairSet = new Set(aggregatePairs)
    if (canonicalManifestJson(aggregatePairs) !== canonicalManifestJson([...plannedSlots.keys()].filter((pair) => aggregatePairSet.has(pair)))) return false
    if (
      value['status'] === 'succeeded'
      && canonicalManifestJson(aggregatePairs) !== canonicalManifestJson([...plannedSlots.keys()])
    ) return false
    for (const rawOutput of value['outputs']) {
      if (!isRecord(rawOutput)) return false
      const resolved = batchOutput(rawOutput['batchResultId'], rawOutput['outputId'])
      if (!resolved || canonicalManifestJson(rawOutput) !== canonicalManifestJson({ ...resolved.output, batchResultId: rawOutput['batchResultId'] })) return false
    }
    if (Array.isArray(value['generatedBatches'])) {
      for (const generated of value['generatedBatches']) {
        if (!isRecord(generated)) return false
        const matches = [...batchResults.values()].filter((batch) =>
          batch.value['batchId'] === generated['batchId']
          && batch.value['generationSlotId'] === generated['generationSlotId']
        )
        if (matches.length !== 1 || canonicalManifestJson(matches[0]?.value['generatedBatch']) !== canonicalManifestJson(generated)) return false
      }
    }
    const requestSort = (left: Record<string, unknown>, right: Record<string, unknown>): number =>
      String(left['invocationId']).localeCompare(String(right['invocationId']))
      || Number(left['requestOrdinal']) - Number(right['requestOrdinal'])
    const aggregateRequests = Array.isArray(value['observedRequests'])
      ? value['observedRequests'].filter(isRecord).sort(requestSort)
      : []
    const batchRequests = aggregateBatches.flatMap((batch) => Array.isArray(batch['observedRequests']) ? batch['observedRequests'].filter(isRecord) : []).sort(requestSort)
    if (
      aggregateRequests.length !== (value['observedRequests'] as unknown[])?.length
      || canonicalManifestJson(aggregateRequests) !== canonicalManifestJson(batchRequests)
    ) return false
    const retrySort = (left: Record<string, unknown>, right: Record<string, unknown>): number =>
      String(left['invocationId']).localeCompare(String(right['invocationId']))
      || Number(left['requestOrdinal']) - Number(right['requestOrdinal'])
    const aggregateRetries = Array.isArray(value['retryAttempts']) ? value['retryAttempts'].filter(isRecord).sort(retrySort) : []
    const batchRetries = aggregateBatches.flatMap((batch) => Array.isArray(batch['retryAttempts']) ? batch['retryAttempts'].filter(isRecord) : []).sort(retrySort)
    if (
      aggregateRetries.length !== (value['retryAttempts'] as unknown[])?.length
      || canonicalManifestJson(aggregateRetries) !== canonicalManifestJson(batchRetries)
    ) return false
    if (!Array.isArray(value['turnOutcomes'])) return false
    for (const rawOutcome of value['turnOutcomes']) {
      if (!isRecord(rawOutcome) || !Array.isArray(rawOutcome['batchIds']) || !Array.isArray(rawOutcome['generationSlotIds']) || rawOutcome['batchIds'].length !== rawOutcome['generationSlotIds'].length) return false
      for (let index = 0; index < rawOutcome['batchIds'].length; index += 1) {
        const batchId = rawOutcome['batchIds'][index]
        const slotId = rawOutcome['generationSlotIds'][index]
        const planned = plannedSlots.get(`${batchId}\0${slotId}`)
        if (!planned || typeof rawOutcome['turnId'] !== 'string' || !planned.orderedTurnIds.includes(rawOutcome['turnId'])) return false
      }
    }
  }

  const admissionSnapshots = new Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>()
  const attemptDirectories = new Map<string, string>()
  for (const reference of referencesForKind('admission-journal')) {
    const value = jsonAt(reference)
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
    const prior = admissionSnapshots.get(snapshotId)
    if (prior && (prior.reference.path !== reference.path || prior.reference.sha256 !== reference.sha256)) return false
    admissionSnapshots.set(snapshotId, { reference, value })
  }
  const journalRoots = new Map<string, number>()
  const journalIds = new Set<string>()
  for (const { value } of admissionSnapshots.values()) {
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
      const previous = typeof previousSnapshotId === 'string' ? admissionSnapshots.get(previousSnapshotId)?.value : undefined
      if (!previous) return false
      validateRenderAdmissionJournalSnapshot(
        value as unknown as RenderAdmissionJournalSnapshot,
        previous as unknown as RenderAdmissionJournalSnapshot
      )
    }
  }
  if ([...journalIds].some((journalId) => journalRoots.get(journalId) !== 1)) return false
  for (const snapshot of admissionSnapshots.values()) {
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
          ? admissionSnapshots.get(previousSnapshotId)?.value
          : undefined
      if (previousSnapshotId !== undefined && !current) return false
    }
  }

  for (const reference of referencesForKind('provider-render-result')) {
    const value = jsonAt(reference)
    const closedBy = value?.['closedBy']
    if (!value || !isRecord(closedBy)) return false
    if (closedBy['kind'] === 'provider-attempt') {
      const terminalSnapshotIds = new Set(referencesForKind('provider-render-result').flatMap((candidate) =>
        candidate.path === reference.path
        && candidate.sha256 === reference.sha256
        && candidate.context?.eventJournalSnapshotId
          ? [candidate.context.eventJournalSnapshotId]
          : []
      ))
      if (terminalSnapshotIds.size !== 1) return false
      const terminalSnapshotId = [...terminalSnapshotIds][0]
      const terminal = terminalSnapshotId ? admissionSnapshots.get(terminalSnapshotId) : undefined
      const recorded = terminal?.value['recordedResult']
      const attemptDir = terminal ? posix.dirname(terminal.reference.path) : undefined
      const recordedPath = isRecord(recorded) ? resolveFrom(attemptDir, recorded['resultRef']) : undefined
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

  for (const batch of batchResults.values()) {
    const value = batch.value
    if (value['provenance'] !== 'provider-dispatch') continue
    const attemptDir = batch.reference.context?.attemptDir
      ?? (batch.reference.path.includes('/batch-results/') ? batch.reference.path.slice(0, batch.reference.path.indexOf('/batch-results/')) : undefined)
    const invocationRef = value['batchInvocationPlan']
    const admissionBasis = value['admissionBasis']
    if (!attemptDir || !isRecord(invocationRef) || !isRecord(admissionBasis)) return false
    const invocationPath = resolveFrom(attemptDir, invocationRef['artifactRef'])
    const invocationPlan = invocationPath ? checkedProviderPath(invocationPath)?.json : undefined
    const basis = typeof admissionBasis['snapshotId'] === 'string' ? admissionSnapshots.get(admissionBasis['snapshotId']) : undefined
    if (
      !invocationPlan
      || invocationPlan['batchInvocationPlanId'] !== invocationRef['batchInvocationPlanId']
      || checkedProviderPath(invocationPath as string)?.sha256 !== invocationRef['sha256']
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

  for (const reference of referencesForKind('admission-journal')) {
    const value = jsonAt(reference)
    if (!value) return false
    if (!Array.isArray(value['recordedBatchResults'])) return false
    const attemptDir = posix.dirname(reference.path)
    for (const rawRecordedBatch of value['recordedBatchResults']) {
      if (!isRecord(rawRecordedBatch) || typeof rawRecordedBatch['batchResultId'] !== 'string') return false
      const batch = batchResults.get(rawRecordedBatch['batchResultId'])
      const batchPath = resolveFrom(attemptDir, rawRecordedBatch['batchResultRef'])
      const admissionBasis = batch?.value['admissionBasis']
      const basisSnapshotId = rawRecordedBatch['admissionBasisSnapshotId']
      const basis = typeof basisSnapshotId === 'string' ? admissionSnapshots.get(basisSnapshotId) : undefined
      const basisPath = isRecord(admissionBasis) ? resolveFrom(attemptDir, admissionBasis['artifactRef']) : undefined
      let ancestor: Record<string, unknown> | undefined = value
      let foundStrictAncestor = false
      while (ancestor && ancestor['previousSnapshotId'] !== undefined) {
        const previousId: unknown = ancestor['previousSnapshotId']
        ancestor = typeof previousId === 'string' ? admissionSnapshots.get(previousId)?.value : undefined
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
      const resultPath = resolveFrom(attemptDir, recorded['resultRef'])
      const aggregate = resultPath ? checkedProviderPath(resultPath)?.json : undefined
      if (
        !aggregate
        || aggregate['resultIdentity'] !== recorded['resultIdentity']
        || checkedProviderPath(resultPath as string)?.sha256 !== recorded['resultSha256']
        || hashCanonicalTtsValue(aggregate['batchResults']) !== recorded['batchResultSetHash']
      ) return false
    }
  }

  const validateSourceBinding = (
    source: Record<string, unknown>,
    resultIdentity: string
  ): boolean => {
    if (source['kind'] === 'provider-output') {
      const resolved = batchOutput(source['batchResultId'], source['outputId'])
      return Boolean(
        resolved
        && source['resultIdentity'] === resultIdentity
        && source['artifactRef'] === resolved.output['artifactRef']
        && source['sha256'] === resolved.output['sha256']
      )
    }
    if (source['kind'] === 'take') {
      if (typeof source['batchResultId'] !== 'string' || typeof source['takeId'] !== 'string') return false
      const batch = batchResults.get(source['batchResultId'])
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

  for (const reference of referencesForKind('audio-run')) {
    const value = jsonAt(reference)
    const renderDir = reference.context?.renderDir
    const audioRunDir = posix.dirname(reference.path)
    const providerResult = value?.['providerResult']
    if (!value || !renderDir || audioRunDir === '.' || !isRecord(providerResult) || typeof providerResult['resultIdentity'] !== 'string') return false
    const providerResultPath = resolveFrom(renderDir, providerResult['path'])
    const aggregate = providerResultPath ? checkedProviderPath(providerResultPath)?.json : undefined
    if (
      !aggregate
      || aggregate['resultIdentity'] !== providerResult['resultIdentity']
      || checkedProviderPath(providerResultPath as string)?.sha256 !== providerResult['sha256']
      || aggregate['renderPlanId'] !== value['renderPlanId']
      || aggregate['renderIdentity'] !== value['renderIdentity']
    ) return false
    for (const role of ['mixPlan', 'transformLedger', 'finalTimeline'] as const) {
      const child = value[role]
      if (!isRecord(child)) return false
      const childPath = resolveFrom(audioRunDir, child['path'])
      if (!childPath || checkedProviderPath(childPath)?.sha256 !== child['sha256']) return false
    }
    const mix = isRecord(value['mixPlan']) ? checkedProviderPath(resolveFrom(audioRunDir, value['mixPlan']['path']) as string)?.json : undefined
    const timeline = isRecord(value['finalTimeline']) ? checkedProviderPath(resolveFrom(audioRunDir, value['finalTimeline']['path']) as string)?.json : undefined
    for (const artifact of [mix, timeline]) {
      const sources = artifact?.[artifact === mix ? 'sources' : 'speechSources']
      if (!Array.isArray(sources) || sources.some((source) => !isRecord(source) || !validateSourceBinding(source, providerResult['resultIdentity'] as string))) return false
    }
  }
  return true
}

const verifyProviderProjectionArtifacts = async (
  rootDir: string,
  provider: PipelineProviderState
): Promise<boolean> => {
  if (provider.legacyRenderIdentity?.startsWith('legacy:')) return true
  if (
    (provider.operation !== 'tts-synthesis' && provider.operation !== 'comic-audio')
    || !provider.targetKey
  ) return true
  const namespace = provider.operation === 'tts-synthesis' ? 'ttsAudio' : 'comicAudio'
  const projection = provider.result?.[namespace]
  if (!isRecord(projection)) return false
  const references = collectProjectionArtifactReferences(projection, provider.targetKey)
  if (!references) return false
  if (references.files.length === 0 && references.directories.length === 0) return true

  const root = resolve(rootDir)
  const artifactRoot = resolve(root, provider.artifactDir)
  try {
    if (!await hasNoSymlinkBelowRoot(root, artifactRoot)) return false
    const artifactEntry = await lstat(artifactRoot)
    if (!artifactEntry.isDirectory() || artifactEntry.isSymbolicLink()) return false
    const canonicalRoot = await realpath(root)
    const canonicalArtifactRoot = await realpath(artifactRoot)
    const artifactFromRoot = relative(canonicalRoot, canonicalArtifactRoot)
    if (artifactFromRoot.startsWith('..') || isAbsolute(artifactFromRoot)) return false

    for (const directoryRef of references.directories) {
      const directory = resolve(artifactRoot, directoryRef)
      if (!isSafeRelativePath(artifactRoot, directoryRef) || !await hasNoSymlinkBelowRoot(artifactRoot, directory)) return false
      const entry = await lstat(directory)
      if (!entry.isDirectory() || entry.isSymbolicLink()) return false
      const canonical = await realpath(directory)
      const fromArtifact = relative(canonicalArtifactRoot, canonical)
      if (fromArtifact.startsWith('..') || isAbsolute(fromArtifact)) return false
    }

    const checked = new Map<string, { sha256: string, json?: Record<string, unknown> | undefined }>()
    const expanded = new Set<string>()
    for (let referenceIndex = 0; referenceIndex < references.files.length; referenceIndex += 1) {
      if (references.files.length > 10_000) return false
      const reference = references.files[referenceIndex]
      if (!reference) return false
      const referenceKey = projectionArtifactReferenceKey(reference)
      const prior = checked.get(referenceKey)
      let json: Record<string, unknown> | undefined
      if (prior !== undefined) {
        if (prior.sha256 !== reference.sha256) return false
        json = prior.json
      } else {
        const referenceRoot = reference.scope === 'run-root' ? root : artifactRoot
        const canonicalReferenceRoot = reference.scope === 'run-root' ? canonicalRoot : canonicalArtifactRoot
        const filePath = resolve(referenceRoot, reference.path)
        if (!isSafeRelativePath(referenceRoot, reference.path) || !await hasNoSymlinkBelowRoot(referenceRoot, filePath)) return false
        const entry = await lstat(filePath)
        if (!entry.isFile() || entry.isSymbolicLink()) return false
        const canonical = await realpath(filePath)
        const fromReferenceRoot = relative(canonicalReferenceRoot, canonical)
        if (fromReferenceRoot.startsWith('..') || isAbsolute(fromReferenceRoot)) return false
        const bytes = await readFile(canonical)
        const actualSha = createHash('sha256').update(bytes).digest('hex')
        if (actualSha !== reference.sha256) return false
        if ((reference.kind !== 'audio' && reference.kind !== 'strategy-text') || reference.expectedJsonFields) {
          try {
            const parsed = JSON.parse(bytes.toString('utf8')) as unknown
            if (!isRecord(parsed)) return false
            json = parsed
          } catch {
            return false
          }
        }
        checked.set(referenceKey, { sha256: reference.sha256, ...(json ? { json } : {}) })
      }
      if (
        reference.expectedJsonFields
        && (!json || Object.entries(reference.expectedJsonFields).some(([key, expected]) => json?.[key] !== expected))
      ) return false
      if (reference.kind !== 'audio' && reference.kind !== 'strategy-text') {
        if (!json) return false
        validateProjectionArtifactJson(reference.kind, json)
        const expansionKey = canonicalManifestJson({ path: reference.path, kind: reference.kind, context: reference.context })
        if (!expanded.has(expansionKey)) {
          expanded.add(expansionKey)
          if (reference.kind === 'admission-journal') {
            references.files.push(...await discoverPreviousAdmissionJournalReference(artifactRoot, reference, json))
          }
          const nested = collectNestedProjectionArtifactReferences(reference, json)
          if (!nested) return false
          references.files.push(...nested)
        }
      }
    }
    if (!validateProjectionArtifactGraphLinks(references.files, checked)) return false
    return true
  } catch {
    return false
  }
}

const verifyManifestProjectionArtifacts = async (
  rootDir: string,
  manifest: PipelineManifest
): Promise<boolean> => {
  const verifyComicItemArtifacts = async (item: PipelineManifestItem): Promise<boolean> => {
    const comic = item.metadata['comic']
    if (!isRecord(comic) || !isRecord(comic['stages']) || !isRecord(comic['audio'])) return false
    const references: Array<{ path: string, sha256: string }> = []
    for (const stage of Object.values(comic['stages'])) {
      if (!isRecord(stage) || !Array.isArray(stage['artifactRefs'])) return false
      for (const ref of stage['artifactRefs']) if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
    }
    const audio = comic['audio']
    for (const key of ['structuredScript', 'dialoguePlanRef', 'snapshotRef', 'mixPlanRef', 'finalTimelineRef'] as const) {
      const ref = audio[key]
      if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
    }
    if (Array.isArray(audio['finalOutputRefs'])) for (const ref of audio['finalOutputRefs']) if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
    for (const ref of references) {
      if (!isSafeRelativePath(rootDir, ref.path)) return false
      try {
        const bytes = await readFile(resolve(rootDir, ref.path))
        if (createHash('sha256').update(bytes).digest('hex') !== ref.sha256) return false
      } catch {
        return false
      }
    }
    return true
  }

  const verifyTtsItemDialoguePlan = async (item: PipelineManifestItem, itemIndex: number): Promise<boolean> => {
    const synthesisProviders = item.providers.filter((provider) =>
      provider.operation === 'tts-synthesis'
      && !provider.legacyRenderIdentity?.startsWith('legacy:')
      && provider.status !== 'skipped'
    )
    if (synthesisProviders.length === 0) return true
    try {
      const references = synthesisProviders.map((provider) => parseTtsDialoguePlanArtifactRef(provider))
      const reference = references[0]
      if (
        !reference
        || references.some((candidate) => canonicalManifestJson(candidate) !== canonicalManifestJson(reference))
      ) return false
      const dialoguePlan = validateGenericTtsDialoguePlan(await readTtsDialoguePlanArtifact(rootDir, reference))
      if (
        dialoguePlan.dialoguePlanId !== reference.dialoguePlanId
        || (dialoguePlan.sourceIdentity.sourceLocator.kind === 'file' && item.input !== dialoguePlan.sourceIdentity.sourceLocator.canonicalPath)
        || (dialoguePlan.sourceIdentity.sourceLocator.kind === 'batch-item' && dialoguePlan.sourceIdentity.sourceLocator.itemIndex !== itemIndex)
      ) return false
      for (const provider of synthesisProviders) {
        const projection = provider.result?.['ttsAudio']
        if (!isRecord(projection) || !Array.isArray(projection['renderHistory'])) return false
        for (const render of projection['renderHistory']) {
          if (!isRecord(render) || typeof render['renderPlanRef'] !== 'string' || !isSha256(render['renderPlanSha256'])) return false
          const planPath = resolve(rootDir, provider.artifactDir, render['renderPlanRef'])
          const planBytes = await readFile(planPath)
          if (createHash('sha256').update(planBytes).digest('hex') !== render['renderPlanSha256']) return false
          const planValue = JSON.parse(planBytes.toString('utf8')) as unknown
          if (!isRecord(planValue)) return false
          const renderPlan = validateProviderRenderPlanIdentity(planValue as unknown as ProviderRenderPlan)
          if (
            renderPlan.dialoguePlanId !== dialoguePlan.dialoguePlanId
            || renderPlan.sourceIdentityHash !== dialoguePlan.sourceIdentity.identityHash
          ) return false
        }
      }
      return true
    } catch {
      return false
    }
  }

  for (const [itemIndex, item] of manifest.items.entries()) {
    for (const provider of item.providers) {
      if (!await verifyProviderProjectionArtifacts(rootDir, provider)) return false
    }
    if (manifest.command === 'tts' && !await verifyTtsItemDialoguePlan(item, itemIndex)) return false
    if (manifest.command === 'comic' && !await verifyComicItemArtifacts(item)) return false
  }
  return true
}

const assertAppendOnlyAudioProjection = (
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

const assertAppendOnlyManifestAudioState = (
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
      if (
        (oldProvider.operation !== 'tts-synthesis' && oldProvider.operation !== 'comic-audio')
        || oldProvider.legacyRenderIdentity?.startsWith('legacy:')
      ) continue
      const nextMatches = nextItem.providers.filter((provider) => provider.targetKey === oldProvider.targetKey)
      if (nextMatches.length !== 1) {
        throw CLIUsageError(`Canonical audio target ${oldProvider.targetKey ?? oldProvider.service} cannot be removed or duplicated.`)
      }
      assertAppendOnlyAudioProjection(oldProvider, nextMatches[0] as PipelineProviderState)
    }
  }
}

const parseChildLink = (
  rootDir: string,
  value: unknown
): PipelineManifestChildLink | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['route', 'index', 'manifestDir'])
    || !isExtractRoute(value['route'])
    || typeof value['index'] !== 'number'
    || !Number.isInteger(value['index'])
    || value['index'] < 0
    || typeof value['manifestDir'] !== 'string'
    || !isSafeRelativePath(rootDir, value['manifestDir'])
  ) {
    return undefined
  }
  return {
    route: value['route'],
    index: value['index'],
    manifestDir: value['manifestDir']
  }
}

const parseManifestItem = (
  rootDir: string,
  value: unknown
): PipelineManifestItem | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['input', 'inputFamily', 'extractRoute', 'outputDir', 'child', 'status', 'metadata', 'providers'])
    || typeof value['status'] !== 'string'
    || !ITEM_STATUS_SET.has(value['status'])
    || !isRecord(value['metadata'])
    || !Array.isArray(value['providers'])
    || (value['input'] !== undefined && typeof value['input'] !== 'string')
    || (value['inputFamily'] !== undefined && !isInputFamily(value['inputFamily']))
    || (value['extractRoute'] !== undefined && !isExtractRoute(value['extractRoute']))
    || (value['outputDir'] !== undefined && (
      typeof value['outputDir'] !== 'string'
      || !isSafeRelativePath(rootDir, value['outputDir'])
    ))
    || (value['child'] !== undefined && parseChildLink(rootDir, value['child']) === undefined)
  ) {
    return undefined
  }
  const providers = value['providers'].map((provider) => parseProviderState(rootDir, provider))
  if (providers.some((provider) => provider === undefined)) {
    return undefined
  }

  const targetKeys = providers.flatMap((provider) => provider?.targetKey ? [provider.targetKey] : [])
  if (new Set(targetKeys).size !== targetKeys.length) {
    return undefined
  }
  const audioArtifactDirs = providers.flatMap((provider) => provider?.targetKey ? [provider.artifactDir] : [])
  if (new Set(audioArtifactDirs).size !== audioArtifactDirs.length) {
    return undefined
  }

  if (
    value['status'] === 'full'
    && providers.some((provider) => provider?.status !== 'succeeded' && provider?.status !== 'skipped')
  ) {
    return undefined
  }

  const child = value['child'] === undefined ? undefined : parseChildLink(rootDir, value['child'])
  return {
    ...(typeof value['input'] === 'string' ? { input: value['input'] } : {}),
    ...(isInputFamily(value['inputFamily']) ? { inputFamily: value['inputFamily'] } : {}),
    ...(isExtractRoute(value['extractRoute']) ? { extractRoute: value['extractRoute'] } : {}),
    ...(typeof value['outputDir'] === 'string' ? { outputDir: value['outputDir'] } : {}),
    ...(child ? { child } : {}),
    status: value['status'] as PipelineManifestItem['status'],
    metadata: value['metadata'],
    providers: providers as PipelineProviderState[]
  }
}

const attachLegacyTtsProviderIdentity = (
  item: PipelineManifestItem,
  provider: PipelineProviderState
): void => {
  if (provider.operation !== undefined || provider.targetKey !== undefined || provider.transport !== undefined) return
  const model = typeof provider.model === 'string' ? provider.model : ''
  const operation = 'tts-synthesis'
  const transport = 'legacy-single'
  const targetKey = canonicalTargetKey(operation, provider.service, model, transport)
  const outputByPath = new Map<string, string | 'unverified'>()
  for (const record of [provider.metadata, provider.result]) {
    if (!isRecord(record)) continue
    for (const pathKey of ['audioFileName', 'audioPath', 'outputPath'] as const) {
      const path = record[pathKey]
      if (typeof path !== 'string' || path.length === 0) continue
      const checksum = [
        record[`${pathKey}Sha256`],
        record['audioFileSha256'],
        record['audioSha256'],
        record['sha256'],
        record['checksum']
      ].find(isSha256) ?? 'unverified'
      const current = outputByPath.get(path)
      if (current === undefined || (current === 'unverified' && checksum !== 'unverified')) {
        outputByPath.set(path, checksum)
      }
    }
  }
  const legacyRenderIdentity = computeLegacySingleRenderIdentity({
    itemInput: item.input ?? '',
    targetKey,
    service: provider.service,
    model: provider.model ?? null,
    canonicalLegacyOptions: provider.options,
    artifactDir: provider.artifactDir,
    outputs: [...outputByPath].map(([path, sha256]) => ({ path, sha256 }))
  })
  Object.defineProperties(provider, {
    operation: { value: operation, enumerable: false, configurable: true },
    targetKey: { value: targetKey, enumerable: false, configurable: true },
    transport: { value: transport, enumerable: false, configurable: true },
    legacyRenderIdentity: {
      value: legacyRenderIdentity,
      enumerable: false,
      configurable: true
    }
  })
}

const expectedTtsItemStatus = (providers: readonly PipelineProviderState[]): PipelineManifestItem['status'] | undefined => {
  if (providers.length === 0) return undefined
  const statuses = providers.map((provider) => provider.status)
  const successCount = statuses.filter((status) => status === 'succeeded').length
  if (statuses.every((status) => status === 'skipped')) return 'skipped'
  if (successCount > 0 && statuses.every((status) => status === 'succeeded' || status === 'skipped')) return 'full'
  if (successCount === 0 && statuses.every((status) => status === 'failed' || status === 'skipped') && statuses.includes('failed')) return 'failed'
  return 'incomplete'
}

const parseComicStageRecord = (
  value: unknown,
  providers: readonly PipelineProviderState[],
  operation: 'comic-structure' | 'comic-image' | 'comic-audio'
): { requirement: 'not-requested' | 'required' | 'optional', status: PipelineManifestItem['status'] } | undefined => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['requirement', 'status', 'execution', 'targetKeys', 'artifactRefs']) || !ITEM_STATUS_SET.has(value['status'] as string) || !Array.isArray(value['targetKeys']) || !Array.isArray(value['artifactRefs'])) return undefined
  if (value['artifactRefs'].some(ref => !isRecord(ref) || !hasOnlyKeys(ref, ['path', 'sha256']) || !isStrictArtifactRelativePath(ref['path']) || !isSha256(ref['sha256']))) return undefined
  const execution = value['execution']
  if (value['requirement'] === 'not-requested') {
    if (value['status'] !== 'skipped' || !isRecord(execution) || !hasOnlyKeys(execution, ['kind', 'reason']) || execution['kind'] !== 'none' || execution['reason'] !== 'not-requested' || value['targetKeys'].length !== 0 || value['artifactRefs'].length !== 0) return undefined
    return { requirement: 'not-requested', status: 'skipped' }
  }
  if (value['requirement'] !== 'required' && value['requirement'] !== 'optional') return undefined
  if (!isRecord(execution)) return undefined
  if (execution['kind'] === 'local') {
    if (!hasOnlyKeys(execution, ['kind', 'state', 'policyReason']) || !PROVIDER_STATUS_SET.has(execution['state'] as string) || value['targetKeys'].length !== 0) return undefined
    const state = execution['state'] as PipelineProviderState['status']
    const expected = state === 'succeeded' ? 'full' : state === 'skipped' ? 'skipped' : state === 'failed' ? 'failed' : 'incomplete'
    if (value['status'] !== expected || (state === 'skipped' && (typeof execution['policyReason'] !== 'string' || !execution['policyReason'].trim()))) return undefined
  } else if (execution['kind'] === 'provider-targets') {
    if (!hasOnlyKeys(execution, ['kind']) || value['targetKeys'].length === 0 || value['targetKeys'].some(key => typeof key !== 'string') || new Set(value['targetKeys'] as string[]).size !== value['targetKeys'].length) return undefined
    const owned = (value['targetKeys'] as string[]).map(key => providers.filter(provider => provider.targetKey === key && provider.operation === operation))
    if (owned.some(matches => matches.length !== 1)) return undefined
    const statuses = owned.map(matches => (matches[0] as PipelineProviderState).status)
    const successCount = statuses.filter(status => status === 'succeeded').length
    const expected = statuses.every(status => status === 'skipped')
      ? 'skipped'
      : successCount > 0 && statuses.every(status => status === 'succeeded' || status === 'skipped')
        ? 'full'
        : successCount === 0 && statuses.every(status => status === 'failed' || status === 'skipped') && statuses.includes('failed')
          ? 'failed'
          : 'incomplete'
    if (value['status'] !== expected) return undefined
  } else return undefined
  return { requirement: value['requirement'], status: value['status'] as PipelineManifestItem['status'] }
}

const expectedComicItemStatus = (
  item: PipelineManifestItem
): PipelineManifestItem['status'] | undefined => {
  const metadata = item.metadata['comic']
  if (!isRecord(metadata) || !hasOnlyKeys(metadata, ['schemaVersion', 'stages', 'audio']) || metadata['schemaVersion'] !== 1 || !isRecord(metadata['stages']) || !isRecord(metadata['audio']) || !hasOnlyKeys(metadata['stages'], ['structure', 'image', 'audio'])) return undefined
  const stages = [
    parseComicStageRecord(metadata['stages']['structure'], item.providers, 'comic-structure'),
    parseComicStageRecord(metadata['stages']['image'], item.providers, 'comic-image'),
    parseComicStageRecord(metadata['stages']['audio'], item.providers, 'comic-audio'),
  ]
  if (stages.some(stage => stage === undefined)) return undefined
  const audio = metadata['audio']
  if (!hasOnlyKeys(audio, ['sceneRunIdentity', 'structuredScript', 'dialoguePlanId', 'dialoguePlanRef', 'snapshotId', 'snapshotRef', 'selectedAudioRuns', 'publishedAudioRunId', 'mixPlanRef', 'finalTimelineRef', 'finalOutputRefs'])) return undefined
  if (audio['sceneRunIdentity'] !== undefined && !isSha256(audio['sceneRunIdentity'])) return undefined
  if (audio['dialoguePlanId'] !== undefined && !isSha256(audio['dialoguePlanId'])) return undefined
  if (audio['snapshotId'] !== undefined && !isSha256(audio['snapshotId'])) return undefined
  const structured = audio['structuredScript']
  if (structured !== undefined && (!isRecord(structured) || !hasOnlyKeys(structured, ['path', 'artifactSchemaVersion', 'sha256']) || structured['path'] !== 'metadata/structured-script.json' || structured['artifactSchemaVersion'] !== 4 || !isSha256(structured['sha256']))) return undefined
  for (const key of ['dialoguePlanRef', 'snapshotRef', 'mixPlanRef', 'finalTimelineRef'] as const) {
    const ref = audio[key]
    if (ref !== undefined && (!isRecord(ref) || !hasOnlyKeys(ref, ['path', 'sha256']) || !isStrictArtifactRelativePath(ref['path']) || !isSha256(ref['sha256']))) return undefined
  }
  if (audio['finalOutputRefs'] !== undefined && (!Array.isArray(audio['finalOutputRefs']) || audio['finalOutputRefs'].some(ref => !isRecord(ref) || !hasOnlyKeys(ref, ['path', 'sha256']) || !isStrictArtifactRelativePath(ref['path']) || !isSha256(ref['sha256'])))) return undefined
  if (audio['selectedAudioRuns'] !== undefined && (!Array.isArray(audio['selectedAudioRuns']) || audio['selectedAudioRuns'].some(ref => !isRecord(ref) || !hasOnlyKeys(ref, ['targetKey', 'renderIdentity', 'audioRunId', 'audioRunRef', 'audioRunSha256']) || !Object.values(ref).every(value => typeof value === 'string') || !isSha256(ref['audioRunSha256'])))) return undefined
  const required = stages.filter(stage => stage?.requirement === 'required') as Array<{ requirement: 'required', status: PipelineManifestItem['status'] }>
  if (required.length === 0) return undefined
  if (required.every(stage => stage.status === 'full' || stage.status === 'skipped') && required.some(stage => stage.status === 'full')) return 'full'
  if (required.every(stage => stage.status === 'skipped')) return 'skipped'
  if (required.every(stage => stage.status === 'failed' || stage.status === 'skipped') && required.some(stage => stage.status === 'failed')) return 'failed'
  return 'incomplete'
}

const parseManifest = (
  rootDir: string,
  value: unknown,
  allowLegacyTts: boolean
): PipelineManifest | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['command', 'scope', 'createdAt', 'updatedAt', 'source', 'items'])
    || !isProcessCommand(value['command'])
    || (value['scope'] !== 'single' && value['scope'] !== 'batch')
    || typeof value['createdAt'] !== 'string'
    || typeof value['updatedAt'] !== 'string'
    || Number.isNaN(Date.parse(value['createdAt']))
    || Number.isNaN(Date.parse(value['updatedAt']))
    || (value['source'] !== undefined && !isRecord(value['source']))
    || !Array.isArray(value['items'])
    || value['items'].length === 0
  ) {
    return undefined
  }

  const items = value['items'].map((item) => parseManifestItem(rootDir, item))
  if (
    items.some((item) => item === undefined)
    || (value['scope'] === 'single' && items.length !== 1)
    || items.some((item) => item?.child !== undefined && (
      value['scope'] !== 'batch'
      || value['command'] !== 'extract'
      || item.extractRoute !== item.child.route
    ))
  ) {
    return undefined
  }

  if (value['scope'] === 'batch') {
    const audioArtifactDirs = items.flatMap((item) => item?.providers.flatMap((provider) =>
      provider.operation === 'tts-synthesis' || provider.operation === 'comic-audio'
        ? [provider.artifactDir]
        : []
    ) ?? [])
    if (new Set(audioArtifactDirs).size !== audioArtifactDirs.length) return undefined
  }

  if (value['command'] === 'tts') {
    for (const item of items) {
      if (!item) return undefined
      if (!allowLegacyTts && item.providers.some((provider) => provider.operation === undefined)) {
        return undefined
      }
      if (item.providers.some((provider) => provider.operation !== undefined && provider.operation !== 'tts-synthesis')) {
        return undefined
      }
      const expectedStatus = expectedTtsItemStatus(item.providers)
      if (expectedStatus === undefined || item.status !== expectedStatus) return undefined
      for (const provider of item.providers) attachLegacyTtsProviderIdentity(item, provider)
    }
  }

  if (value['command'] === 'comic') {
    if (value['scope'] !== 'single' || items.length !== 1 || !isRecord(value['source'])) return undefined
    try {
      validateComicSourceIdentity(value['source'] as unknown as ComicSourceIdentity)
    } catch {
      return undefined
    }
    const item = items[0]
    if (!item || item.input !== value['source']['canonicalPath'] || item.outputDir !== '.') return undefined
    const expectedStatus = expectedComicItemStatus(item)
    if (!expectedStatus || item.status !== expectedStatus) return undefined
    const targetOwners = new Map<string, number>()
    const comic = item.metadata['comic'] as unknown as CanonicalComicItemMetadata
    for (const stage of Object.values(comic.stages)) for (const targetKey of stage.targetKeys) targetOwners.set(targetKey, (targetOwners.get(targetKey) ?? 0) + 1)
    if ([...targetOwners.values()].some(count => count !== 1)) return undefined
    if (item.providers.some(provider => provider.operation?.startsWith('comic-') && !targetOwners.has(provider.targetKey ?? ''))) return undefined
  }

  return {
    command: value['command'],
    scope: value['scope'],
    createdAt: value['createdAt'],
    updatedAt: value['updatedAt'],
    ...(isRecord(value['source']) ? { source: value['source'] } : {}),
    items: items as PipelineManifestItem[]
  }
}

const invalidManifestError = (manifestPath: string): Error =>
  CLIUsageError(`Invalid canonical manifest at ${manifestPath}. Re-run the pipeline to regenerate this output.`)

const readManifestUnlocked = async (
  rootDir: string
): Promise<PipelineManifest | undefined> => {
  const manifestPath = join(rootDir, PIPELINE_MANIFEST_FILE)
  if (!await Bun.file(manifestPath).exists()) {
    return undefined
  }

  let raw: unknown
  try {
    raw = await Bun.file(manifestPath).json() as unknown
  } catch (error) {
    throw CLIUsageError(`Malformed canonical manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const manifest = parseManifest(rootDir, raw, true)
  if (!manifest || !await verifyManifestProjectionArtifacts(rootDir, manifest)) {
    throw invalidManifestError(manifestPath)
  }
  return manifest
}

const manifestQueues = new Map<string, Promise<void>>()

const withManifestLock = async <T>(
  rootDir: string,
  action: () => Promise<T>
): Promise<T> => {
  const key = resolve(rootDir)
  const previous = manifestQueues.get(key) ?? Promise.resolve()
  let release = (): void => {}
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate
  })
  const queued = previous.catch(() => undefined).then(async () => await gate)
  manifestQueues.set(key, queued)
  await previous.catch(() => undefined)
  try {
    return await action()
  } finally {
    release()
    if (manifestQueues.get(key) === queued) {
      manifestQueues.delete(key)
    }
  }
}

const writeManifestUnlocked = async (
  rootDir: string,
  manifest: PipelineManifest,
  previous?: PipelineManifest | undefined
): Promise<PipelineManifest> => {
  const manifestPath = join(rootDir, PIPELINE_MANIFEST_FILE)
  const next = {
    ...manifest,
    updatedAt: new Date().toISOString()
  }
  const parsed = parseManifest(rootDir, next, false)
  if (!parsed || !await verifyManifestProjectionArtifacts(rootDir, parsed)) {
    throw invalidManifestError(manifestPath)
  }
  if (previous) assertAppendOnlyManifestAudioState(previous, parsed)

  const tempPath = join(rootDir, `.${PIPELINE_MANIFEST_FILE}.${process.pid}.${randomUUID()}.tmp`)
  try {
    await Bun.write(tempPath, `${JSON.stringify(parsed, null, 2)}\n`)
    await rename(tempPath, manifestPath)
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined)
  }
  return parsed
}

export const readManifest = async (
  rootDir: string
): Promise<PipelineManifest | undefined> => await readManifestUnlocked(rootDir)

export const writeManifest = async (
  rootDir: string,
  manifest: PipelineManifest
): Promise<PipelineManifest> =>
  await withManifestLock(rootDir, async () => {
    const current = await readManifestUnlocked(rootDir)
    return await writeManifestUnlocked(rootDir, manifest, current)
  })

export const updateManifest = async (
  rootDir: string,
  update: (manifest: PipelineManifest) => PipelineManifest | Promise<PipelineManifest>
): Promise<PipelineManifest> =>
  await withManifestLock(rootDir, async () => {
    const current = await readManifestUnlocked(rootDir)
    if (!current) {
      throw CLIUsageError(`Missing canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)}`)
    }
    return await writeManifestUnlocked(rootDir, await update(current), current)
  })

export const createManifest = (
  command: ProcessCommand,
  scope: PipelineManifest['scope'],
  items: PipelineManifestItem[],
  source?: Record<string, unknown>
): PipelineManifest => {
  const now = new Date().toISOString()
  return {
    command,
    scope,
    createdAt: now,
    updatedAt: now,
    ...(source ? { source } : {}),
    items
  }
}

export const createManifestItem = (
  rootDir: string,
  input: Omit<PipelineManifestItem, 'outputDir' | 'child' | 'providers'> & {
    outputDir?: string | undefined
    child?: Omit<PipelineManifestChildLink, 'manifestDir'> & { manifestDir: string } | undefined
    providers?: PipelineProviderState[] | undefined
  }
): PipelineManifestItem => {
  const item: PipelineManifestItem = {
    ...(input.input !== undefined ? { input: input.input } : {}),
    ...(input.inputFamily !== undefined ? { inputFamily: input.inputFamily } : {}),
    ...(input.extractRoute !== undefined ? { extractRoute: input.extractRoute } : {}),
    ...(input.outputDir !== undefined ? { outputDir: toManifestRelativePath(rootDir, input.outputDir) } : {}),
    ...(input.child
      ? {
          child: {
            route: input.child.route,
            index: input.child.index,
            manifestDir: toManifestRelativePath(rootDir, input.child.manifestDir)
          }
        }
      : {}),
    status: input.status,
    metadata: input.metadata,
    providers: (input.providers ?? []).map((provider) => ({
      ...provider,
      artifactDir: toManifestRelativePath(rootDir, provider.artifactDir)
    }))
  }
  const parsed = parseManifestItem(rootDir, item)
  if (!parsed) {
    throw CLIUsageError('Cannot construct an invalid canonical manifest item.')
  }
  return parsed
}

const providerKey = (value: Record<string, unknown>): string | undefined =>
  typeof value['targetKey'] === 'string'
    ? `target\u0000${value['targetKey']}`
    : typeof value['service'] === 'string'
      ? `${value['service']}\u0000${typeof value['model'] === 'string' ? value['model'] : ''}`
    : undefined

const providerOptions = (value: Record<string, unknown>): Record<string, unknown> => {
  const options = { ...value }
  delete options['service']
  delete options['model']
  delete options['local']
  delete options['operation']
  delete options['targetKey']
  delete options['transport']
  delete options['artifactDir']
  delete options['status']
  delete options['attempts']
  delete options['lastError']
  delete options['error']
  delete options['metadata']
  delete options['result']
  return options
}

const findProviderMetadata = (
  record: Record<string, unknown>,
  service: string,
  model: string | null | undefined
): Record<string, unknown> | undefined => {
  const rawStep2 = record['step2']
  const entries = (Array.isArray(rawStep2) ? rawStep2 : rawStep2 === undefined ? [] : [rawStep2])
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
  return entries.find((entry) =>
    (entry['transcriptionService'] === service && (model == null || entry['transcriptionModel'] === model))
    || (entry['ocrService'] === service && (model == null || entry['ocrModel'] === model))
    || (entry['service'] === service && (model == null || entry['model'] === model))
    || (typeof entry['extractionMethod'] === 'string' && entry['extractionMethod'] === `html+${service}`)
  )
}

const createProviderStatesFromRecord = (
  rootDir: string,
  record: Record<string, unknown>
): PipelineProviderState[] => {
  const requested = Array.isArray(record['requestedProviders'])
    ? record['requestedProviders'].filter((value): value is Record<string, unknown> => isRecord(value))
    : []
  const requestedEntries = requested.flatMap((value) => {
    const key = providerKey(value)
    return key ? [[key, value] as const] : []
  })
  const requestedByKey = new Map(requestedEntries)
  if (requestedByKey.size !== requestedEntries.length) {
    throw CLIUsageError('Requested provider targets must be unique before canonical persistence.')
  }
  const rawStates = Array.isArray(record['providerStates'])
    ? record['providerStates'].filter((value): value is Record<string, unknown> => isRecord(value))
    : []
  const statesByKey = new Set<string>()
  const states = rawStates.map((state): PipelineProviderState => {
    const key = providerKey(state)
    if (!key || typeof state['service'] !== 'string') {
      throw CLIUsageError('Cannot persist a provider state without a service identity.')
    }
    if (statesByKey.has(key)) {
      throw CLIUsageError('Canonical provider states cannot duplicate one requested target.')
    }
    statesByKey.add(key)
    const request = requestedByKey.get(key)
    if (requested.length > 0 && !request) {
      throw CLIUsageError('Canonical provider states must contain only explicitly requested targets.')
    }
    const status = typeof state['status'] === 'string' && PROVIDER_STATUS_SET.has(state['status'])
      ? state['status'] as PipelineProviderState['status']
      : 'missing'
    const artifactDir = typeof state['artifactDir'] === 'string' ? state['artifactDir'] : '.'
    return {
      service: state['service'],
      ...(typeof state['model'] === 'string' || state['model'] === null ? { model: state['model'] } : {}),
      ...(typeof state['local'] === 'boolean' ? { local: state['local'] } : {}),
      ...(typeof state['operation'] === 'string' ? { operation: state['operation'] } : {}),
      ...(typeof state['targetKey'] === 'string' ? { targetKey: state['targetKey'] } : {}),
      ...(typeof state['transport'] === 'string' ? { transport: state['transport'] } : {}),
      artifactDir: toManifestRelativePath(rootDir, artifactDir),
      status,
      attempts: typeof state['attempts'] === 'number' && Number.isInteger(state['attempts']) && state['attempts'] >= 0
        ? state['attempts']
        : 0,
      options: isRecord(state['options'])
        ? state['options']
        : request
          ? providerOptions(request)
          : {},
      metadata: isRecord(state['metadata'])
        ? state['metadata']
        : findProviderMetadata(record, state['service'], typeof state['model'] === 'string' || state['model'] === null ? state['model'] : undefined) ?? {},
      ...(isRecord(state['result']) ? { result: state['result'] } : {}),
      ...(isRecord(state['error'])
        ? { error: state['error'] }
        : isRecord(state['lastError'])
          ? { error: state['lastError'] }
          : {})
    }
  })

  for (const request of requested) {
    const key = providerKey(request)
    if (!key || statesByKey.has(key) || typeof request['service'] !== 'string') {
      continue
    }
    if (request['operation'] === 'tts-synthesis' || request['operation'] === 'comic-audio') {
      throw CLIUsageError('A requested audio target requires its real durable canonical provider state before persistence.')
    }
    states.push({
      service: request['service'],
      ...(typeof request['model'] === 'string' || request['model'] === null ? { model: request['model'] } : {}),
      ...(typeof request['local'] === 'boolean' ? { local: request['local'] } : {}),
      ...(typeof request['operation'] === 'string' ? { operation: request['operation'] } : {}),
      ...(typeof request['targetKey'] === 'string' ? { targetKey: request['targetKey'] } : {}),
      ...(typeof request['transport'] === 'string' ? { transport: request['transport'] } : {}),
      artifactDir: '.',
      status: 'missing',
      attempts: 0,
      options: providerOptions(request),
      metadata: {}
    })
  }
  return states
}

export const createPipelineItemFromRecord = (
  rootDir: string,
  record: PipelineItemRecord,
  options: {
    status?: PipelineManifestItem['status'] | undefined
    input?: string | undefined
    inputFamily?: InputFamily | undefined
    extractRoute?: ExtractRoute | undefined
    outputDir?: string | undefined
    child?: PipelineManifestChildLink | undefined
  } = {}
): PipelineManifestItem => {
  const metadata = { ...record }
  for (const key of [
    'input',
    'inputFamily',
    'extractRoute',
    'outputDir',
    'childBatchEntry',
    'completionStatus',
    'status',
    'requestedProviders',
    'providerStates',
    'missingProviders',
    'blockedProviders'
  ]) {
    delete metadata[key]
  }
  const providers = createProviderStatesFromRecord(rootDir, record)
  if (providers.length > 0) {
    delete metadata['step2']
  }

  const storedStatus = record['completionStatus'] === 'full'
    || record['completionStatus'] === 'incomplete'
    || record['completionStatus'] === 'failed'
    || record['completionStatus'] === 'skipped'
    ? record['completionStatus']
    : record['status'] === 'failed'
      ? 'failed'
      : record['status'] === 'completed'
        ? 'full'
        : undefined
  const child = options.child
  const rawInputFamily = options.inputFamily ?? record['inputFamily']
  const rawRoute = options.extractRoute ?? record['extractRoute']
  return createManifestItem(rootDir, {
    ...(options.input !== undefined
      ? { input: options.input }
      : typeof record['input'] === 'string'
        ? { input: record['input'] }
        : {}),
    ...(isInputFamily(rawInputFamily) ? { inputFamily: rawInputFamily } : {}),
    ...(isExtractRoute(rawRoute) ? { extractRoute: rawRoute } : {}),
    ...(options.outputDir !== undefined
      ? { outputDir: options.outputDir }
      : typeof record['outputDir'] === 'string'
        ? { outputDir: record['outputDir'] }
        : {}),
    ...(child ? { child } : {}),
    status: options.status ?? storedStatus ?? 'incomplete',
    metadata,
    providers
  })
}

export const derivePipelineItemRecord = (
  rootDir: string,
  item: PipelineManifestItem
): PipelineItemRecord => {
  const requestedProviders = item.providers.map((provider) => ({
    service: provider.service,
    ...(provider.model !== undefined ? { model: provider.model } : {}),
    ...(provider.local !== undefined ? { local: provider.local } : {}),
    ...(provider.operation !== undefined ? { operation: provider.operation } : {}),
    ...(provider.targetKey !== undefined ? { targetKey: provider.targetKey } : {}),
    ...(provider.transport !== undefined ? { transport: provider.transport } : {}),
    ...provider.options
  }))
  const providerStates = item.providers.map((provider) => ({
    service: provider.service,
    ...(provider.model !== undefined ? { model: provider.model } : {}),
    ...(provider.local !== undefined ? { local: provider.local } : {}),
    ...(provider.operation !== undefined ? { operation: provider.operation } : {}),
    ...(provider.targetKey !== undefined ? { targetKey: provider.targetKey } : {}),
    ...(provider.transport !== undefined ? { transport: provider.transport } : {}),
    artifactDir: provider.artifactDir,
    status: provider.status,
    attempts: provider.attempts,
    options: provider.options,
    metadata: provider.metadata,
    ...(provider.result ? { result: provider.result } : {}),
    ...(provider.error ? { lastError: provider.error } : {})
  }))
  const missingProviders = requestedProviders.filter((_, index) => {
    const status = item.providers[index]?.status
    return status === 'missing' || status === 'failed'
  })
  const blockedProviders = requestedProviders.filter((_, index) => {
    const error = item.providers[index]?.error
    return error?.['retryable'] === false || typeof error?.['blockedReason'] === 'string'
  })
  const successfulMetadata = item.providers
    .filter((provider) => provider.status === 'succeeded' && Object.keys(provider.metadata).length > 0)
    .map((provider) => provider.metadata)

  return {
    ...item.metadata,
    ...(item.input !== undefined ? { input: item.input } : {}),
    ...(item.inputFamily !== undefined ? { inputFamily: item.inputFamily } : {}),
    ...(item.extractRoute !== undefined ? { extractRoute: item.extractRoute } : {}),
    ...(successfulMetadata.length === 1
      ? { step2: successfulMetadata[0] }
      : successfulMetadata.length > 1
        ? { step2: successfulMetadata }
        : {}),
    outputDir: item.outputDir !== undefined
      ? resolveManifestRelativePath(rootDir, item.outputDir)
      : resolve(rootDir),
    ...(item.child ? { childBatchEntry: { route: item.child.route, index: item.child.index } } : {}),
    completionStatus: item.status,
    requestedProviders,
    providerStates,
    missingProviders,
    blockedProviders
  }
}

export const readSinglePipelineItemRecord = async (
  rootDir: string,
  expected: {
    command?: ProcessCommand | undefined
    extractRoute?: ExtractRoute | undefined
  } = {}
): Promise<PipelineItemRecord | undefined> => {
  const manifest = await readManifest(rootDir)
  if (
    !manifest
    || manifest.scope !== 'single'
    || manifest.items.length !== 1
    || (expected.command !== undefined && manifest.command !== expected.command)
  ) {
    return undefined
  }
  const item = manifest.items[0]
  if (!item || (expected.extractRoute !== undefined && item.extractRoute !== expected.extractRoute)) {
    return undefined
  }
  return derivePipelineItemRecord(rootDir, item)
}

type ManifestProviderSelector = {
  service: string
  model?: string | null | undefined
  operation?: string | undefined
  targetKey?: string | undefined
  transport?: string | undefined
  artifactDir?: string | undefined
}

const matchesManifestProvider = (
  rootDir: string,
  provider: PipelineProviderState,
  selector: ManifestProviderSelector
): boolean =>
  provider.service === selector.service
  && (!Object.hasOwn(selector, 'model') || provider.model === selector.model)
  && (selector.operation === undefined || provider.operation === selector.operation)
  && (selector.targetKey === undefined || provider.targetKey === selector.targetKey)
  && (selector.transport === undefined || provider.transport === selector.transport)
  && (selector.artifactDir === undefined
    || provider.artifactDir === toManifestRelativePath(rootDir, selector.artifactDir))

export const readSingleManifestProviderState = async (
  rootDir: string,
  selector: ManifestProviderSelector
): Promise<PipelineProviderState | undefined> => {
  const manifest = await readManifest(rootDir)
  if (!manifest || manifest.scope !== 'single' || manifest.items.length !== 1) {
    return undefined
  }
  return manifest.items[0]?.providers.find((provider) =>
    matchesManifestProvider(rootDir, provider, selector)
  )
}

export const updateSingleManifestProviderState = async (
  rootDir: string,
  selector: ManifestProviderSelector,
  update: (provider: PipelineProviderState) => PipelineProviderState | Promise<PipelineProviderState>
): Promise<PipelineProviderState> => {
  let updatedProvider: PipelineProviderState | undefined
  await updateManifest(rootDir, async (manifest) => {
    if (manifest.scope !== 'single' || manifest.items.length !== 1) {
      throw CLIUsageError(`Canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)} is not a single-run manifest.`)
    }
    const item = manifest.items[0]
    if (!item) {
      throw invalidManifestError(join(rootDir, PIPELINE_MANIFEST_FILE))
    }
    const providerIndex = item.providers.findIndex((provider) =>
      matchesManifestProvider(rootDir, provider, selector)
    )
    const provider = item.providers[providerIndex]
    if (!provider) {
      throw CLIUsageError(`Canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)} has no matching ${selector.service} provider state.`)
    }
    const nextProvider = await update(provider)
    if (!matchesManifestProvider(rootDir, nextProvider, selector)) {
      throw CLIUsageError('A manifest provider-state update cannot change the selected provider identity or artifact path.')
    }
    assertAppendOnlyAudioProjection(provider, nextProvider)
    updatedProvider = nextProvider
    const providers = item.providers.slice()
    providers[providerIndex] = nextProvider
    const items = manifest.items.slice()
    const reducedTtsStatus = manifest.command === 'tts' ? expectedTtsItemStatus(providers) : undefined
    if (manifest.command === 'tts' && reducedTtsStatus === undefined) {
      throw CLIUsageError('A requested TTS item must retain at least one canonical provider state.')
    }
    items[0] = { ...item, providers, ...(reducedTtsStatus ? { status: reducedTtsStatus } : {}) }
    return { ...manifest, items }
  })
  if (!updatedProvider) {
    throw CLIUsageError(`Canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)} was not updated.`)
  }
  return updatedProvider
}

export const writePipelineItemRecords = async (
  rootDir: string,
  command: ProcessCommand,
  scope: PipelineManifest['scope'],
  records: PipelineItemRecord[],
  options: {
    extractRoute?: ExtractRoute | undefined
    source?: Record<string, unknown> | undefined
  } = {}
): Promise<PipelineManifest> => {
  if (scope === 'single' && records.length !== 1) {
    throw CLIUsageError('A single-run canonical manifest must contain exactly one item record.')
  }
  const current = await readManifest(rootDir)
  const next = createManifest(
    command,
    scope,
    records.map((record) => createPipelineItemFromRecord(rootDir, record, {
      ...(options.extractRoute ? { extractRoute: options.extractRoute } : {}),
      ...(scope === 'single' ? { outputDir: rootDir } : {})
    })),
    options.source
  )
  return await writeManifest(rootDir, {
    ...next,
    ...(current ? { createdAt: current.createdAt } : {})
  })
}
