import { posix } from 'node:path'
import type { NestedCollector, ProjectionArtifactReference } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { isSha256 } from './guards'

const collectCompactRenderNested: NestedCollector = (ctx) => {
  const slots = ctx.value['slots']
  if (!Array.isArray(slots)) return false
  for (const rawSlot of slots) {
    if (!isRecord(rawSlot) || typeof rawSlot['slotHash'] !== 'string' || !isSha256(rawSlot['sha256'])) return false
    const slotDir = posix.dirname(ctx.reference.path)
    const mediaRoot = slotDir.includes('/') ? posix.dirname(slotDir) : ''
    const defaultSlotPath = mediaRoot ? `${mediaRoot}/slots/${rawSlot['slotHash']}.wav` : `slots/${rawSlot['slotHash']}.wav`
    const slotPath = rawSlot['audioArtifactRef'] ?? defaultSlotPath
    if (typeof slotPath !== 'string' || ![defaultSlotPath, defaultSlotPath.replace(/\.wav$/, '-' + rawSlot['sha256'] + '.wav')].includes(slotPath)) return false
    ctx.nested.push({ path: slotPath, sha256: rawSlot['sha256'] as string, kind: 'audio', scope: 'run-root' })
  }
  return true
}

const collectReadinessResultNested: NestedCollector = (ctx) => {
  const fixture = ctx.value['capabilityFixture']
  return isRecord(fixture) && ctx.add(fixture, 'path', 'sha256', 'capability-fixture', undefined, {
    capabilityFixtureHash: fixture['capabilityFixtureHash'] as string
  })
}

const hasUnsupportedRepairOrContinuation = (reference: ProjectionArtifactReference, value: Record<string, unknown>): boolean => {
  const repair = value['repair']
  const branchHasRepair = reference.kind === 'branch-plan'
    && Array.isArray(value['candidateStrategies'])
    && value['candidateStrategies'].some((candidate) => isRecord(candidate) && candidate['repair'] !== undefined)
  const hasExternalContinuation = reference.kind === 'render-plan'
    && Array.isArray(value['batches'])
    && value['batches'].some((batch) =>
      isRecord(batch) && isRecord(batch['continuation']) && batch['continuation']['kind'] === 'external-checkpoint'
    )
  return repair !== undefined || branchHasRepair || hasExternalContinuation
}

const plannedTurnsOf = (value: Record<string, unknown>): Record<string, unknown>[] => Array.isArray(value['nodes'])
  ? value['nodes'].flatMap((node) => {
      if (!isRecord(node)) return []
      if (node['kind'] === 'turn' && isRecord(node['turn'])) return [node['turn']]
      if (node['kind'] === 'overlap' && Array.isArray(node['turns'])) return node['turns'].filter(isRecord)
      return []
    })
  : []

const plannedSlotsOf = (value: Record<string, unknown>): Record<string, unknown>[] => Array.isArray(value['batches'])
  ? value['batches'].flatMap((batch) => isRecord(batch) && Array.isArray(batch['generationSlots']) ? batch['generationSlots'].filter(isRecord) : [])
  : []

type AddNestedReference = Parameters<NestedCollector>[0]['add']

type StrategyPlanArtifacts = Readonly<{
  plannedTurns: readonly Record<string, unknown>[]
  plannedSlots: readonly Record<string, unknown>[]
  turnArtifacts: readonly unknown[]
  slotArtifacts: readonly unknown[]
}>

const strategyArtifactsMatchPlan = ({ turnArtifacts, slotArtifacts, plannedTurns, plannedSlots }: StrategyPlanArtifacts): boolean =>
  turnArtifacts.length === plannedTurns.length
  && slotArtifacts.length === plannedSlots.length
  && !turnArtifacts.some((artifact, index) => !isRecord(artifact) || artifact['turnId'] !== plannedTurns[index]?.['turnId'])
  && !slotArtifacts.some((artifact, index) => !isRecord(artifact) || artifact['generationSlotId'] !== plannedSlots[index]?.['generationSlotId'])

const hasUniqueArtifactPaths = (allArtifacts: readonly unknown[]): boolean => {
  const artifactPaths = allArtifacts.flatMap((artifact) => isRecord(artifact) && typeof artifact['path'] === 'string' ? [artifact['path']] : [])
  return artifactPaths.length === allArtifacts.length && new Set(artifactPaths).size === artifactPaths.length
}

const addTurnAndSlotTextArtifacts = (
  add: AddNestedReference,
  renderDir: string,
  { turnArtifacts, plannedTurns, slotArtifacts }: StrategyPlanArtifacts
): boolean => {
  for (const [index, rawArtifact] of turnArtifacts.entries()) {
    const plannedTurn = plannedTurns[index]
    if (!isRecord(rawArtifact) || !isRecord(plannedTurn) || typeof plannedTurn['canonicalText'] !== 'string') return false
    const canonicalText = plannedTurn['canonicalText'].endsWith('\n') ? plannedTurn['canonicalText'] : `${plannedTurn['canonicalText']}\n`
    const expectedSha = new Bun.CryptoHasher('sha256').update(canonicalText).digest('hex')
    if (rawArtifact['sha256'] !== expectedSha || !add(rawArtifact, 'path', 'sha256', 'strategy-text', renderDir, undefined, { renderDir })) return false
  }
  for (const rawArtifact of slotArtifacts) {
    if (!isRecord(rawArtifact) || !add(rawArtifact, 'path', 'sha256', 'strategy-text', renderDir, undefined, { renderDir })) return false
  }
  return true
}

const collectRenderPlanNested: NestedCollector = (ctx) => {
  const { reference, value, renderDir, add } = ctx
  if (hasUnsupportedRepairOrContinuation(reference, value)) return false
  if (reference.kind !== 'render-plan') return true
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
  const plannedTurns = plannedTurnsOf(value)
  const plannedSlots = plannedSlotsOf(value)
  const turnArtifacts = strategy['turns']
  const slotArtifacts = strategy['generationSlots']
  const planArtifacts: StrategyPlanArtifacts = { plannedTurns, plannedSlots, turnArtifacts, slotArtifacts }
  if (!strategyArtifactsMatchPlan(planArtifacts)) return false
  if (!hasUniqueArtifactPaths([strategy['sourceIdentity'], strategy['dialoguePlan'], strategy['normalizedDialogue'], ...turnArtifacts, ...slotArtifacts])) return false
  if (!add(strategy['sourceIdentity'], 'path', 'sha256', 'source-identity', renderDir, { identityHash: value['sourceIdentityHash'] as string }, { renderDir })) return false
  if (!add(strategy['dialoguePlan'], 'path', 'sha256', 'dialogue-plan', renderDir, { dialoguePlanId: value['dialoguePlanId'] as string }, { renderDir })) return false
  if (!add(strategy['normalizedDialogue'], 'path', 'sha256', 'strategy-text', renderDir, undefined, { renderDir })) return false
  return addTurnAndSlotTextArtifacts(add, renderDir, planArtifacts)
}

export const RENDER_NESTED_COLLECTORS: Partial<Record<ProjectionArtifactReference['kind'], NestedCollector>> = {
  'compact-render': collectCompactRenderNested,
  'readiness-result': collectReadinessResultNested,
  'render-plan': collectRenderPlanNested,
  'branch-plan': collectRenderPlanNested
}
