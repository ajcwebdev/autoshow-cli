import { readFile, readdir, realpath, lstat } from 'node:fs/promises'
import { resolve, relative, isAbsolute, posix } from 'node:path'
import { createHash } from 'node:crypto'
import type {
  AccountCapabilityObservation,
  AnyCapabilityRecord,
  AudioRun,
  CacheMaterializationPlan,
  ComicDialoguePlan,
  ComicSourceIdentity,
  GenericTtsDialoguePlan,
  GenericTtsSourceIdentity,
  PipelineManifest,
  PipelineManifestItem,
  PipelineProviderState,
  ProviderBatchInvocationPlan,
  ProviderBatchResult,
  ProviderReadinessResult,
  ProviderRenderBranchPlan,
  ProviderRenderPlan,
  ProviderRenderResult,
  RenderAdmissionJournalSnapshot
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { assertContentIdentity, hashCanonicalTtsValue } from '../step-4-tts/script-to-audio/contract-identity'
import {
  validateAccountCapabilityObservation,
  validateCacheMaterializationPlan,
  validateCapabilityFacetSet,
  validateGenericTtsDialoguePlan,
  validateGenericTtsSourceIdentity,
  validateProviderBatchResult,
  validateProviderRenderPlanIdentity,
  validateProviderRenderResult,
  validateRenderAdmissionJournalSnapshot
} from '../step-4-tts/script-to-audio/contract-validation'
import { parseTtsDialoguePlanArtifactRef, readTtsDialoguePlanArtifact } from '../step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { validateComicDialoguePlan, validateComicSourceIdentity } from '../step-8-comic/comic-utils/comic-audio-contracts'
import {
  canonicalManifestJson,
  hasNoSymlinkBelowRoot,
  isIsoDateTime,
  isSafeRelativePath,
  isSha256,
  isStrictArtifactRelativePath
} from './guards'
import {
  collectNestedProjectionArtifactReferences,
  collectProjectionArtifactReferences,
  projectionArtifactReferenceKey,
  resolveArtifactRelativePath
} from './projection-artifact-references'
import type {
  ProjectionArtifactReference,
  ProjectionArtifactReferences
} from './projection-artifact-references'

type JsonArtifactValidator = (value: Record<string, unknown>) => void

const validateBranchPlanJson: JsonArtifactValidator = (value) => {
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
}

const validateCompactRenderJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Compact TTS render requires schemaVersion 1.')
  if (typeof value['renderId'] !== 'string' || typeof value['targetKey'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['slots'])) {
    throw CLIUsageError('Compact TTS render is missing identity or slot index.')
  }
}

const validateSourceIdentityJson: JsonArtifactValidator = (value) => {
  if (typeof value['canonicalPath'] === 'string') validateComicSourceIdentity(value as unknown as ComicSourceIdentity)
  else validateGenericTtsSourceIdentity(value as unknown as GenericTtsSourceIdentity)
}

const validateDialoguePlanJson: JsonArtifactValidator = (value) => {
  if (typeof value['sceneRunIdentity'] === 'string') validateComicDialoguePlan(value as unknown as ComicDialoguePlan)
  else validateGenericTtsDialoguePlan(value as unknown as GenericTtsDialoguePlan)
}

const validateCapabilityFixtureJson: JsonArtifactValidator = (value) => {
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
}

const validateReadinessResultJson: JsonArtifactValidator = (value) => {
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
}

const validateAdmissionEvidenceJson: JsonArtifactValidator = (value) => {
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
}

const validateAudioRunJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Audio run requires schemaVersion 1.')
  assertContentIdentity(value, 'audioRunId', 'Audio run')
  const audioRun = value as unknown as AudioRun
  if (!audioRun.targetKey || !audioRun.renderPlanId || !audioRun.renderIdentity || audioRun.finalOutputs.length === 0) {
    throw CLIUsageError('Audio run requires its target, render, and final output identities.')
  }
}

const validateAudioMixPlanJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Audio mix plan requires schemaVersion 1.')
  assertContentIdentity(value, 'mixPlanId', 'Audio mix plan')
  if (typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['sources']) || !Array.isArray(value['operations']) || !isIsoDateTime(value['createdAt'])) {
    throw CLIUsageError('Audio mix plan has invalid render, source, operation, or creation evidence.')
  }
}

const validateAudioTransformLedgerJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Audio transform ledger requires schemaVersion 1.')
  assertContentIdentity(value, 'transformLedgerId', 'Audio transform ledger')
  if (typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['operations'])) {
    throw CLIUsageError('Audio transform ledger has invalid render or operation evidence.')
  }
}

const validateFinalTimelineJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Final timeline requires schemaVersion 1.')
  assertContentIdentity(value, 'timelineId', 'Final timeline')
  if (typeof value['renderIdentity'] !== 'string' || !isRecord(value['timing']) || !Array.isArray(value['speechSources']) || !isRecord(value['transformLedgerRef'])) {
    throw CLIUsageError('Final timeline has invalid render, timing, source, or transform-ledger evidence.')
  }
}

const validateBatchInvocationPlanJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Provider batch invocation plan requires schemaVersion 1.')
  assertContentIdentity(value, 'batchInvocationPlanId', 'Provider batch invocation plan')
  const plan = value as unknown as ProviderBatchInvocationPlan
  if (!plan.renderPlanId || !plan.renderIdentity || !plan.invocationId || !plan.batchId || !plan.generationSlotId) {
    throw CLIUsageError('Provider batch invocation plan requires complete render, attempt, batch, and slot identity.')
  }
}

const validateProviderTimingEvidenceJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Provider timing evidence requires schemaVersion 1.')
  assertContentIdentity(value, 'timingEvidenceId', 'Provider timing evidence')
  if (typeof value['provider'] !== 'string' || typeof value['model'] !== 'string' || typeof value['providerTimeUnit'] !== 'string' || !isRecord(value['payload'])) {
    throw CLIUsageError('Provider timing evidence has invalid provider, model, unit, or payload fields.')
  }
}

const validateRenderTakesJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Render takes artifact requires schemaVersion 1.')
  assertContentIdentity(value, 'renderTakesId', 'Render takes artifact')
  if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['generationSlots'])) {
    throw CLIUsageError('Render takes artifact has invalid render or generation-slot evidence.')
  }
}

const validateTakeSelectionJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Take selection requires schemaVersion 1.')
  assertContentIdentity(value, 'selectionId', 'Take selection')
  if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || typeof value['batchId'] !== 'string' || !Array.isArray(value['batchResults'])) {
    throw CLIUsageError('Take selection has invalid render, batch, or result evidence.')
  }
}

const validateContinuationCheckpointJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Continuation checkpoint requires schemaVersion 1.')
  assertContentIdentity(value, 'checkpointId', 'Continuation checkpoint')
  if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !isRecord(value['batchResult']) || !isRecord(value['selection'])) {
    throw CLIUsageError('Continuation checkpoint has invalid render, result, or selection evidence.')
  }
}

const validateConsumedSelectionRebuildJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw CLIUsageError('Consumed-selection rebuild authorization requires schemaVersion 1.')
  assertContentIdentity(value, 'authorizationId', 'Consumed-selection rebuild authorization')
  if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['authorizedPotentialDispatchSlots'])) {
    throw CLIUsageError('Consumed-selection rebuild authorization has invalid render or slot evidence.')
  }
}

const JSON_VALIDATORS: Partial<Record<ProjectionArtifactReferences['files'][number]['kind'], JsonArtifactValidator>> = {
  'branch-plan': validateBranchPlanJson,
  'render-plan': (value) => validateProviderRenderPlanIdentity(value as unknown as ProviderRenderPlan),
  'compact-render': validateCompactRenderJson,
  'source-identity': validateSourceIdentityJson,
  'dialogue-plan': validateDialoguePlanJson,
  'capability-fixture': validateCapabilityFixtureJson,
  'readiness-result': validateReadinessResultJson,
  'admission-journal': (value) => validateRenderAdmissionJournalSnapshot(value as unknown as RenderAdmissionJournalSnapshot),
  'admission-evidence': validateAdmissionEvidenceJson,
  'provider-render-result': (value) => validateProviderRenderResult(value as unknown as ProviderRenderResult),
  'audio-run': validateAudioRunJson,
  'audio-mix-plan': validateAudioMixPlanJson,
  'audio-transform-ledger': validateAudioTransformLedgerJson,
  'final-timeline': validateFinalTimelineJson,
  'batch-invocation-plan': validateBatchInvocationPlanJson,
  'provider-batch-result': (value) => validateProviderBatchResult(value as unknown as ProviderBatchResult),
  'provider-timing-evidence': validateProviderTimingEvidenceJson,
  'cache-materialization-plan': (value) => validateCacheMaterializationPlan(value as unknown as CacheMaterializationPlan),
  'render-takes': validateRenderTakesJson,
  'take-selection': validateTakeSelectionJson,
  'continuation-checkpoint': validateContinuationCheckpointJson,
  'consumed-selection-rebuild': validateConsumedSelectionRebuildJson
}

export const validateProjectionArtifactJson = (
  kind: ProjectionArtifactReferences['files'][number]['kind'],
  value: Record<string, unknown>
): void => {
  const validator = JSON_VALIDATORS[kind]
  if (validator) {
    validator(value)
  }
}

export const discoverPreviousAdmissionJournalReference = async (
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

export type GraphLinkContext = {
  references: readonly ProjectionArtifactReference[]
  checked: ReadonlyMap<string, { sha256: string, json?: Record<string, unknown> | undefined }>
  referencesForKind: (kind: ProjectionArtifactReference['kind']) => ProjectionArtifactReference[]
  checkedProviderPath: (path: string) => { sha256: string, json?: Record<string, unknown> | undefined } | undefined
  jsonAt: (reference: ProjectionArtifactReference) => Record<string, unknown> | undefined
  resolveFrom: (baseDir: string | undefined, path: unknown) => string | undefined
  capabilityFixtures: Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>
  branchPlansById: Map<string, Record<string, unknown>>
  renderPlansByCandidate: Map<string, Record<string, unknown>>
  renderPlansById: Map<string, Record<string, unknown>>
  batchResults: Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>
  admissionSnapshots: Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>
  batchOutput: (batchResultId: unknown, outputId: unknown) => { batch: { reference: ProjectionArtifactReference, value: Record<string, unknown> }, output: Record<string, unknown> } | undefined
}

const createGraphLinkContext = (
  references: readonly ProjectionArtifactReference[],
  checked: ReadonlyMap<string, { sha256: string, json?: Record<string, unknown> | undefined }>
): GraphLinkContext => {
  const referencesForKind = (kind: ProjectionArtifactReference['kind']) => references.filter((reference) => reference.kind === kind)
  const checkedReference = (reference: ProjectionArtifactReference) => checked.get(projectionArtifactReferenceKey(reference))
  const checkedProviderPath = (path: string) => checked.get(`provider-artifact\0${path}`)
  const jsonAt = (reference: ProjectionArtifactReference): Record<string, unknown> | undefined => checkedReference(reference)?.json
  const resolveFrom = (baseDir: string | undefined, path: unknown): string | undefined => resolveArtifactRelativePath(baseDir, path)

  const capabilityFixtures = new Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>()
  const branchPlansById = new Map<string, Record<string, unknown>>()
  const renderPlansByCandidate = new Map<string, Record<string, unknown>>()
  const renderPlansById = new Map<string, Record<string, unknown>>()
  const batchResults = new Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>()
  const admissionSnapshots = new Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>()

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

  return {
    references,
    checked,
    referencesForKind,
    checkedProviderPath,
    jsonAt,
    resolveFrom,
    capabilityFixtures,
    branchPlansById,
    renderPlansByCandidate,
    renderPlansById,
    batchResults,
    admissionSnapshots,
    batchOutput
  }
}

const validateCapabilityFixtureLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('capability-fixture')) {
    const value = ctx.jsonAt(reference)
    const fixtureHash = value?.['capabilityFixtureHash']
    if (!value || typeof fixtureHash !== 'string') return false
    const prior = ctx.capabilityFixtures.get(fixtureHash)
    if (prior && (prior.reference.path !== reference.path || prior.reference.sha256 !== reference.sha256 || canonicalManifestJson(prior.value) !== canonicalManifestJson(value))) return false
    ctx.capabilityFixtures.set(fixtureHash, { reference, value })
  }
  return true
}

const validateBranchPlanLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('branch-plan')) {
    const value = ctx.jsonAt(reference)
    const branchPlanId = value?.['branchPlanId']
    if (!value || typeof branchPlanId !== 'string') return false
    const prior = ctx.branchPlansById.get(branchPlanId)
    if (prior && canonicalManifestJson(prior) !== canonicalManifestJson(value)) return false
    ctx.branchPlansById.set(branchPlanId, value)
  }
  return true
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
  ...(turn['effect'] !== undefined ? { effect: turn['effect'] } : {}),
  ...(turn['timingCues'] !== undefined ? { timingCues: turn['timingCues'] } : {})
})

const validateRenderPlanLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('render-plan')) {
    const value = ctx.jsonAt(reference)
    const candidateId = value?.['branchCandidateId']
    const branchPlanId = value?.['branchPlanId']
    const renderPlanId = value?.['renderPlanId']
    if (!value || typeof candidateId !== 'string' || typeof branchPlanId !== 'string' || typeof renderPlanId !== 'string') return false
    const candidateKey = `${branchPlanId}\0${candidateId}`
    const prior = ctx.renderPlansByCandidate.get(candidateKey)
    if (prior && canonicalManifestJson(prior) !== canonicalManifestJson(value)) return false
    ctx.renderPlansByCandidate.set(candidateKey, value)
    const priorPlan = ctx.renderPlansById.get(renderPlanId)
    if (priorPlan && canonicalManifestJson(priorPlan) !== canonicalManifestJson(value)) return false
    ctx.renderPlansById.set(renderPlanId, value)
  }
  for (const reference of ctx.referencesForKind('render-plan')) {
    const value = ctx.jsonAt(reference)
    const renderDir = reference.context?.renderDir
    const strategy = value?.['strategyArtifacts']
    if (!value || !renderDir || !isRecord(strategy) || !isRecord(strategy['sourceIdentity']) || !isRecord(strategy['dialoguePlan']) || !Array.isArray(value['nodes'])) return false
    const sourcePath = resolveArtifactRelativePath(renderDir, strategy['sourceIdentity']['path'])
    const dialoguePath = resolveArtifactRelativePath(renderDir, strategy['dialoguePlan']['path'])
    const source = sourcePath ? ctx.checkedProviderPath(sourcePath)?.json : undefined
    const dialogue = dialoguePath ? ctx.checkedProviderPath(dialoguePath)?.json : undefined
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
  return true
}

const validateReadinessResultCandidate = (
  ctx: GraphLinkContext,
  reference: ProjectionArtifactReference,
  readinessValue: Record<string, unknown>,
  branchPlan: Record<string, unknown>,
  capabilityScopeHash: string
): boolean => {
  const candidateId = reference.context?.branchCandidateId
  if (!candidateId) return true
  const renderPlan = ctx.renderPlansByCandidate.get(`${readinessValue['branchPlanId']}\0${candidateId}`)
  if (!renderPlan) return false
  const candidates = (readinessValue['candidateReadiness'] as unknown[]).filter((candidate) => isRecord(candidate) && candidate['candidateId'] === candidateId)
  const candidate = candidates[0]
  const branchCandidates = (branchPlan['candidateStrategies'] as unknown[]).filter((entry) => isRecord(entry) && entry['candidateId'] === candidateId)
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
    || renderPlan['capabilityFixtureHash'] !== (readinessValue['capabilityFixture'] as Record<string, unknown>)['capabilityFixtureHash']
    || canonicalManifestJson(renderPlan['requiredCapabilityScopeHashes']) !== canonicalManifestJson([capabilityScopeHash])
    || branchCandidate['strategy'] !== renderPlan['strategy']
    || canonicalManifestJson(branchCandidate['requiredCapabilityScopeHashes']) !== canonicalManifestJson(renderPlan['requiredCapabilityScopeHashes'])
    || branchCandidate['requestedOutputHash'] !== renderPlan['outputProfileHash']
    || canonicalManifestJson(branchCandidate['plannedCost']) !== canonicalManifestJson(renderPlan['plannedCost'])
    || canonicalManifestJson(branchCandidate['batchSketches']) !== canonicalManifestJson(expectedBatchSketches)
  ) return false
  const observationHashes = Array.isArray(readinessValue['capabilityObservations'])
    ? readinessValue['capabilityObservations'].flatMap((observation) => isRecord(observation) && typeof observation['observationHash'] === 'string' ? [observation['observationHash']] : [])
    : []
  if (
    canonicalManifestJson(candidate['accountObservationHashes']) !== canonicalManifestJson(observationHashes)
    || (reference.context?.accountObservationHashes ?? []).some((hash) => !observationHashes.includes(hash))
  ) return false
  return true
}

const validateReadinessResultLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('readiness-result')) {
    const value = ctx.jsonAt(reference)
    const fixtureRef = value?.['capabilityFixture']
    if (!value || !isRecord(fixtureRef) || typeof fixtureRef['capabilityFixtureHash'] !== 'string') return false
    const fixture = ctx.capabilityFixtures.get(fixtureRef['capabilityFixtureHash'])
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
    const branchPlan = typeof value['branchPlanId'] === 'string' ? ctx.branchPlansById.get(value['branchPlanId']) : undefined
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
    if (!validateReadinessResultCandidate(ctx, reference, value, branchPlan, capabilityScopeHash)) return false
  }
  return true
}

const validateProviderBatchResultLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('provider-batch-result')) {
    const value = ctx.jsonAt(reference)
    const batchResultId = value?.['batchResultId']
    if (!value || typeof batchResultId !== 'string') return false
    const prior = ctx.batchResults.get(batchResultId)
    if (prior && (prior.reference.path !== reference.path || prior.reference.sha256 !== reference.sha256)) return false
    ctx.batchResults.set(batchResultId, { reference, value })
  }
  return true
}

const validateProviderRenderResultLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('provider-render-result')) {
    const value = ctx.jsonAt(reference)
    const renderDir = reference.context?.renderDir
    if (!value || !renderDir || !Array.isArray(value['batchResults']) || !Array.isArray(value['outputs'])) return false
    const renderPlan = typeof value['renderPlanId'] === 'string' ? ctx.renderPlansById.get(value['renderPlanId']) : undefined
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
      const batch = ctx.batchResults.get(rawResult['batchResultId'])
      const expectedPath = ctx.resolveFrom(renderDir, rawResult['artifactRef'])
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
      const resolved = ctx.batchOutput(rawOutput['batchResultId'], rawOutput['outputId'])
      if (!resolved || canonicalManifestJson(rawOutput) !== canonicalManifestJson({ ...resolved.output, batchResultId: rawOutput['batchResultId'] })) return false
    }
    if (Array.isArray(value['generatedBatches'])) {
      for (const generated of value['generatedBatches']) {
        if (!isRecord(generated)) return false
        const matches = aggregateBatches.filter((batch) =>
          batch['batchId'] === generated['batchId']
          && batch['generationSlotId'] === generated['generationSlotId']
        )
        if (matches.length !== 1 || canonicalManifestJson(matches[0]?.['generatedBatch']) !== canonicalManifestJson(generated)) return false
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
  return true
}

const validateAdmissionJournalLinks = (ctx: GraphLinkContext): boolean => {
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

const validateRenderResultClosedByLinks = (ctx: GraphLinkContext): boolean => {
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

const validateBatchResultProvenanceLinks = (ctx: GraphLinkContext): boolean => {
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

const validateJournalRecordedBatchLinks = (ctx: GraphLinkContext): boolean => {
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

const validateAudioRunLinks = (ctx: GraphLinkContext): boolean => {
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

const GRAPH_LINK_PASSES: readonly ((ctx: GraphLinkContext) => boolean)[] = [
  validateCapabilityFixtureLinks,
  validateBranchPlanLinks,
  validateRenderPlanLinks,
  validateReadinessResultLinks,
  validateProviderBatchResultLinks,
  validateProviderRenderResultLinks,
  validateAdmissionJournalLinks,
  validateRenderResultClosedByLinks,
  validateBatchResultProvenanceLinks,
  validateJournalRecordedBatchLinks,
  validateAudioRunLinks
]

export const validateProjectionArtifactGraphLinks = (
  references: readonly ProjectionArtifactReference[],
  checked: ReadonlyMap<string, { sha256: string, json?: Record<string, unknown> | undefined }>
): boolean => {
  const ctx = createGraphLinkContext(references, checked)
  return GRAPH_LINK_PASSES.every((pass) => pass(ctx))
}

export const verifyProviderProjectionArtifacts = async (
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
    const visitedReferences = new Set<string>()
    for (let referenceIndex = 0; referenceIndex < references.files.length; referenceIndex += 1) {
      const reference = references.files[referenceIndex]
      if (!reference) return false
      const visitedKey = canonicalManifestJson(reference)
      if (visitedReferences.has(visitedKey)) continue
      visitedReferences.add(visitedKey)
      if (visitedReferences.size > 10_000) return false
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
        if (reference.kind === 'admission-journal' && reference.path.endsWith('.jsonl')) {
          const lastLine = bytes.toString('utf8').split('\n').filter((line) => line.length > 0).at(-1)
          if (!lastLine) return false
          try {
            const parsed = JSON.parse(lastLine) as unknown
            const snapshot = isRecord(parsed) && isRecord(parsed['snapshot']) ? parsed['snapshot'] : parsed
            if (!isRecord(snapshot)) return false
            json = snapshot
          } catch {
            return false
          }
        } else if ((reference.kind !== 'audio' && reference.kind !== 'strategy-text') || reference.expectedJsonFields) {
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
        const expansionKey = canonicalManifestJson({
          path: reference.path,
          kind: reference.kind,
          context: reference.kind === 'admission-journal' ? undefined : reference.context
        })
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

export const verifyManifestProjectionArtifacts = async (
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
    for (const key of ['structuredScript', 'dialoguePlanRef', 'snapshotRef', 'mixPlanRef', 'finalTimelineRef', 'soundscapePlanRef', 'soundEffectRenderPlanRef', 'soundEffectRenderResultRef'] as const) {
      const ref = audio[key]
      if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
    }
    if (Array.isArray(audio['finalOutputRefs'])) for (const ref of audio['finalOutputRefs']) if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
    if (Array.isArray(audio['selectedAudioRuns'])) for (const run of audio['selectedAudioRuns']) {
      if (isRecord(run) && typeof run['audioRunRef'] === 'string' && typeof run['audioRunSha256'] === 'string') references.push({ path: run['audioRunRef'], sha256: run['audioRunSha256'] })
    }
    if (Array.isArray(audio['selectedSoundscapeRuns'])) for (const run of audio['selectedSoundscapeRuns']) {
      if (isRecord(run) && typeof run['audioRunRef'] === 'string' && typeof run['audioRunSha256'] === 'string') references.push({ path: run['audioRunRef'], sha256: run['audioRunSha256'] })
      if (isRecord(run) && isRecord(run['masterRef']) && typeof run['masterRef']['path'] === 'string' && typeof run['masterRef']['sha256'] === 'string') references.push({ path: run['masterRef']['path'], sha256: run['masterRef']['sha256'] })
    }
    const presentation = comic['presentation']
    if (isRecord(presentation)) {
      for (const key of ['planRef', 'resolvedTimelineRef', 'runRef'] as const) {
        const ref = presentation[key]
        if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
      }
      if (Array.isArray(presentation['finalOutputRefs'])) for (const ref of presentation['finalOutputRefs']) if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
    }
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
