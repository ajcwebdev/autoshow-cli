import type { GraphLinkContext } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { canonicalManifestJson } from './guards'
import { resolveArtifactRelativePath } from './projection-artifact-references'

export { validateReadinessResultLinks } from './readiness-result-link-validation'

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
