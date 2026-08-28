import type { AccountCapabilityObservation, GraphLinkContext, ProjectionArtifactReference } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { hashCanonicalTtsValue } from '../step-4-tts/script-to-audio/contract-identity'
import { validateAccountCapabilityObservation } from '../step-4-tts/script-to-audio/contract-validation'
import { canonicalManifestJson } from './guards'
import { resolveArtifactRelativePath } from './projection-artifact-references'

type ReadinessFixtureContext = Readonly<{
  branchPlan: Record<string, unknown>
  capabilityScopeHash: string
  observationsByHash: ReadonlyMap<string, Record<string, unknown>>
}>

const resolveReadinessFixture = (
  ctx: GraphLinkContext,
  value: Record<string, unknown>
): ReadinessFixtureContext | undefined => {
  const fixtureRef = value['capabilityFixture']
  if (!isRecord(fixtureRef) || typeof fixtureRef['capabilityFixtureHash'] !== 'string') return undefined
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
  ) return undefined
  const capabilityScopeHash = fixture.value['capabilityScopeHash'] as string
  const observationsByHash = new Map<string, Record<string, unknown>>()
  for (const rawObservation of value['capabilityObservations']) {
    if (!isRecord(rawObservation)) return undefined
    validateAccountCapabilityObservation(rawObservation as unknown as AccountCapabilityObservation, {
      capabilityScopeHash,
      capabilityFixtureHash: fixtureRef['capabilityFixtureHash']
    })
    const observationHash = rawObservation['observationHash']
    if (typeof observationHash !== 'string' || observationsByHash.has(observationHash)) return undefined
    observationsByHash.set(observationHash, rawObservation)
  }
  const branchPlan = typeof value['branchPlanId'] === 'string' ? ctx.branchPlansById.get(value['branchPlanId']) : undefined
  if (!branchPlan || branchPlan['capabilityFixtureHash'] !== fixtureRef['capabilityFixtureHash']) return undefined
  return { branchPlan, capabilityScopeHash, observationsByHash }
}

const validateCandidateReadiness = (
  value: Record<string, unknown>,
  branchPlan: Record<string, unknown>,
  observationsByHash: ReadonlyMap<string, Record<string, unknown>>
): number | undefined => {
  if (!Array.isArray(value['candidateReadiness']) || !Array.isArray(branchPlan['candidateStrategies'])) return undefined
  const branchCandidates = branchPlan['candidateStrategies']
  const readinessCandidates = value['candidateReadiness']
  if (readinessCandidates.length !== branchCandidates.length) return undefined
  let readyCandidateCount = 0
  const seenCandidateIds = new Set<string>()
  for (let index = 0; index < branchCandidates.length; index += 1) {
    const branchCandidate = branchCandidates[index]
    const readinessCandidate = readinessCandidates[index]
    if (!isRecord(branchCandidate) || !isRecord(readinessCandidate)) return undefined
    const branchCandidateId = branchCandidate['candidateId']
    if (
      typeof branchCandidateId !== 'string'
      || seenCandidateIds.has(branchCandidateId)
      || readinessCandidate['candidateId'] !== branchCandidateId
      || readinessCandidate['strategy'] !== branchCandidate['strategy']
      || canonicalManifestJson(readinessCandidate['requiredCapabilityScopeHashes']) !== canonicalManifestJson(branchCandidate['requiredCapabilityScopeHashes'])
      || !Array.isArray(readinessCandidate['accountObservationHashes'])
      || !Array.isArray(readinessCandidate['errors'])
    ) return undefined
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
    ) return undefined
    const observationsAvailable = expectedObservationHashes.length === requiredScopes.length
      && expectedObservationHashes.every((hash) => observationsByHash.get(hash)?.['state'] === 'available')
    const candidateReady = readinessCandidate['status'] === 'ready'
    if (
      (readinessCandidate['status'] !== 'ready' && readinessCandidate['status'] !== 'blocked')
      || candidateReady !== (observationsAvailable && readinessCandidate['errors'].length === 0)
    ) return undefined
    if (candidateReady) readyCandidateCount += 1
  }
  return readyCandidateCount
}

const validateAggregateReadinessStatus = (value: Record<string, unknown>, readyCandidateCount: number): boolean => (
  Array.isArray(value['errors'])
  && (value['status'] === 'ready') === (readyCandidateCount > 0)
  && (value['status'] !== 'ready' || value['errors'].length === 0)
  && (value['status'] !== 'blocked' || value['errors'].length > 0)
)

const expectedBatchSketches = (renderPlan: Record<string, unknown>): unknown => Array.isArray(renderPlan['batches'])
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

const validateAuthorizedCandidate = (
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
    || canonicalManifestJson(branchCandidate['batchSketches']) !== canonicalManifestJson(expectedBatchSketches(renderPlan))
  ) return false
  const observationHashes = Array.isArray(readinessValue['capabilityObservations'])
    ? readinessValue['capabilityObservations'].flatMap((observation) => isRecord(observation) && typeof observation['observationHash'] === 'string' ? [observation['observationHash']] : [])
    : []
  return canonicalManifestJson(candidate['accountObservationHashes']) === canonicalManifestJson(observationHashes)
    && (reference.context?.accountObservationHashes ?? []).every((hash) => observationHashes.includes(hash))
}

export const validateReadinessResultLinks = (ctx: GraphLinkContext): boolean => {
  for (const reference of ctx.referencesForKind('readiness-result')) {
    const value = ctx.jsonAt(reference)
    if (!value) return false
    const fixture = resolveReadinessFixture(ctx, value)
    if (!fixture) return false
    const readyCandidateCount = validateCandidateReadiness(value, fixture.branchPlan, fixture.observationsByHash)
    if (readyCandidateCount === undefined || !validateAggregateReadinessStatus(value, readyCandidateCount)) return false
    if (!validateAuthorizedCandidate(ctx, reference, value, fixture.branchPlan, fixture.capabilityScopeHash)) return false
  }
  return true
}
