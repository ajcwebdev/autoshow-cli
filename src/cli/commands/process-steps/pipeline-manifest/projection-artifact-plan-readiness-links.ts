import type { AccountCapabilityObservation } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { hashCanonicalTtsValue } from '../step-4-tts/script-to-audio/contract-identity'
import { validateAccountCapabilityObservation } from '../step-4-tts/script-to-audio/contract-validation'
import { canonicalManifestJson } from './guards'
import { resolveArtifactRelativePath } from './projection-artifact-references'
import type { GraphLinkContext } from './projection-artifact-link-context'
import type { ProjectionArtifactReference } from './projection-artifact-references'

export const validateCapabilityFixtureLinks = (ctx: GraphLinkContext): boolean => {
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

export const validateBranchPlanLinks = (ctx: GraphLinkContext): boolean => {
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

export const validateRenderPlanLinks = (ctx: GraphLinkContext): boolean => {
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

export const validateReadinessResultLinks = (ctx: GraphLinkContext): boolean => {
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
