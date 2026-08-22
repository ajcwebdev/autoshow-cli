import type {
  AnyCapabilityRecord,
  AudioRun,
  CacheMaterializationPlan,
  ComicDialoguePlan,
  ComicSourceIdentity,
  GenericTtsDialoguePlan,
  GenericTtsSourceIdentity,
  JsonArtifactValidator,
  ProjectionArtifactReferences,
  ProviderBatchInvocationPlan,
  ProviderBatchResult,
  ProviderReadinessResult,
  ProviderRenderBranchPlan,
  ProviderRenderPlan,
  ProviderRenderResult,
  RenderAdmissionJournalSnapshot
} from '~/types'
import { UsageError } from '~/utils/error-handler'
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
import { validateComicDialoguePlan, validateComicSourceIdentity } from '../step-8-comic/comic-utils/comic-audio-contracts'
import { isIsoDateTime, isSha256, isStrictArtifactRelativePath } from './guards'

const validateBranchPlanJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Provider render branch plan requires schemaVersion 1.')
  assertContentIdentity(value, 'branchPlanId', 'Provider render branch plan')
  const branch = value as unknown as ProviderRenderBranchPlan
  if (
    branch.targetKey !== canonicalTargetKey(branch.operation, branch.provider, branch.model, branch.transport)
    || !Array.isArray(branch.candidateStrategies)
    || branch.candidateStrategies.length === 0
  ) {
    throw UsageError('Provider render branch plan has an invalid target or no candidate strategy.')
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
    ) throw UsageError('Provider render branch candidate has invalid capability, batch, or output evidence.')
  }
}

const validateCompactRenderJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Compact TTS render requires schemaVersion 1.')
  if (typeof value['renderId'] !== 'string' || typeof value['targetKey'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['slots'])) {
    throw UsageError('Compact TTS render is missing identity or slot index.')
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
    throw UsageError('Provider capability fixture requires schemaVersion 1 and one exact capability record.')
  }
  validateCapabilityFacetSet(value['records'] as AnyCapabilityRecord[])
  const record = value['records'][0]
  if (
    !isRecord(record)
    || !isRecord(record['scope'])
    || value['capabilityFixtureHash'] !== hashCanonicalTtsValue({ schemaVersion: 1, records: value['records'] })
    || value['capabilityScopeHash'] !== hashCanonicalTtsValue(record['scope'])
  ) {
    throw UsageError('Provider capability fixture has an invalid fixture or capability-scope identity.')
  }
}

const validateReadinessResultJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Provider readiness result requires schemaVersion 1.')
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
    throw UsageError('Provider readiness result has an invalid identity, status, or evidence collection.')
  }
  const capabilityFixture = readiness.capabilityFixture
  if (
    capabilityFixture === undefined
    || !isSha256(capabilityFixture.capabilityFixtureHash)
    || !isStrictArtifactRelativePath(capabilityFixture.path)
    || !isSha256(capabilityFixture.sha256)
  ) {
    throw UsageError('Provider readiness result requires an exact retained capability fixture reference.')
  }
  for (const observation of readiness.capabilityObservations) {
    validateAccountCapabilityObservation(observation)
  }
}

const validateAdmissionEvidenceJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Sanitized admission evidence requires schemaVersion 1.')
  assertContentIdentity(value, 'evidenceHash', 'Sanitized admission evidence')
  if (
    typeof value['journalId'] !== 'string'
    || typeof value['invocationId'] !== 'string'
    || !Number.isInteger(value['requestOrdinal'])
    || !isSha256(value['requestFingerprint'])
    || !['acceptance', 'completion', 'rejection', 'ambiguity', 'not-admitted'].includes(value['evidenceKind'] as string)
    || !isIsoDateTime(value['observedAt'])
    || !isRecord(value['fields'])
  ) throw UsageError('Sanitized admission evidence does not bind a complete request and proof kind.')
}

const validateAudioRunJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Audio run requires schemaVersion 1.')
  assertContentIdentity(value, 'audioRunId', 'Audio run')
  const audioRun = value as unknown as AudioRun
  if (!audioRun.targetKey || !audioRun.renderPlanId || !audioRun.renderIdentity || audioRun.finalOutputs.length === 0) {
    throw UsageError('Audio run requires its target, render, and final output identities.')
  }
}

const validateAudioMixPlanJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Audio mix plan requires schemaVersion 1.')
  assertContentIdentity(value, 'mixPlanId', 'Audio mix plan')
  if (typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['sources']) || !Array.isArray(value['operations']) || !isIsoDateTime(value['createdAt'])) {
    throw UsageError('Audio mix plan has invalid render, source, operation, or creation evidence.')
  }
}

const validateAudioTransformLedgerJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Audio transform ledger requires schemaVersion 1.')
  assertContentIdentity(value, 'transformLedgerId', 'Audio transform ledger')
  if (typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['operations'])) {
    throw UsageError('Audio transform ledger has invalid render or operation evidence.')
  }
}

const validateFinalTimelineJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Final timeline requires schemaVersion 1.')
  assertContentIdentity(value, 'timelineId', 'Final timeline')
  if (typeof value['renderIdentity'] !== 'string' || !isRecord(value['timing']) || !Array.isArray(value['speechSources']) || !isRecord(value['transformLedgerRef'])) {
    throw UsageError('Final timeline has invalid render, timing, source, or transform-ledger evidence.')
  }
}

const validateBatchInvocationPlanJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Provider batch invocation plan requires schemaVersion 1.')
  assertContentIdentity(value, 'batchInvocationPlanId', 'Provider batch invocation plan')
  const plan = value as unknown as ProviderBatchInvocationPlan
  if (!plan.renderPlanId || !plan.renderIdentity || !plan.invocationId || !plan.batchId || !plan.generationSlotId) {
    throw UsageError('Provider batch invocation plan requires complete render, attempt, batch, and slot identity.')
  }
}

const validateProviderTimingEvidenceJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Provider timing evidence requires schemaVersion 1.')
  assertContentIdentity(value, 'timingEvidenceId', 'Provider timing evidence')
  if (typeof value['provider'] !== 'string' || typeof value['model'] !== 'string' || typeof value['providerTimeUnit'] !== 'string' || !isRecord(value['payload'])) {
    throw UsageError('Provider timing evidence has invalid provider, model, unit, or payload fields.')
  }
}

const validateRenderTakesJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Render takes artifact requires schemaVersion 1.')
  assertContentIdentity(value, 'renderTakesId', 'Render takes artifact')
  if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['generationSlots'])) {
    throw UsageError('Render takes artifact has invalid render or generation-slot evidence.')
  }
}

const validateTakeSelectionJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Take selection requires schemaVersion 1.')
  assertContentIdentity(value, 'selectionId', 'Take selection')
  if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || typeof value['batchId'] !== 'string' || !Array.isArray(value['batchResults'])) {
    throw UsageError('Take selection has invalid render, batch, or result evidence.')
  }
}

const validateContinuationCheckpointJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Continuation checkpoint requires schemaVersion 1.')
  assertContentIdentity(value, 'checkpointId', 'Continuation checkpoint')
  if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !isRecord(value['batchResult']) || !isRecord(value['selection'])) {
    throw UsageError('Continuation checkpoint has invalid render, result, or selection evidence.')
  }
}

const validateConsumedSelectionRebuildJson: JsonArtifactValidator = (value) => {
  if (value['schemaVersion'] !== 1) throw UsageError('Consumed-selection rebuild authorization requires schemaVersion 1.')
  assertContentIdentity(value, 'authorizationId', 'Consumed-selection rebuild authorization')
  if (typeof value['renderPlanId'] !== 'string' || typeof value['renderIdentity'] !== 'string' || !Array.isArray(value['authorizedPotentialDispatchSlots'])) {
    throw UsageError('Consumed-selection rebuild authorization has invalid render or slot evidence.')
  }
}

export const JSON_VALIDATORS: Partial<Record<ProjectionArtifactReferences['files'][number]['kind'], JsonArtifactValidator>> = {
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
