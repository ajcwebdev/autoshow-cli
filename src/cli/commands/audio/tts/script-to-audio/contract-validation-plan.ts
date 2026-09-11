import type { CanonicalAudioProviderProjection, HybridRepairDependencies, ProviderRenderPlan } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { assertSha256, assertUnique } from './contract-validation-primitives'
import { validateRenderPlanBatches } from './render-plan-batch-validation'
import { validateRenderPlanHeader } from './render-plan-header-validation'
import { validateRenderPlanTurns } from './render-plan-turn-validation'
import { validateRenderPlanVoiceContext } from './render-plan-voice-context-validation'

export const validateProviderRenderPlanIdentity = (plan: ProviderRenderPlan): ProviderRenderPlan => {
  validateRenderPlanHeader(plan)
  const turns = validateRenderPlanTurns(plan)
  validateRenderPlanBatches(plan, turns)
  validateRenderPlanVoiceContext(plan, turns)
  if (plan.strategy === 'hybrid') validateHybridRepairDependencies(plan.repair)
  return plan
}

export const projectCanonicalAudioProviderStatus = (
  projection: CanonicalAudioProviderProjection
): { status: 'missing' | 'running' | 'succeeded' | 'failed' | 'skipped', attempts: number } => {
  if (projection.archive && projection.selectedSuccess && !projection.activeWork) {
    return { status: 'succeeded', attempts: 0 }
  }
  const active = projection.activeWork
  if (!active) throw UsageError('New audio provider projection requires activeWork.')
  if (active.kind === 'policy-skip') {
    if (projection.branchHistory.length > 0 || projection.readinessAttempts.length > 0 || projection.renderHistory.length > 0 || projection.selectedSuccess) {
      throw UsageError('Policy skip is valid only before any provider work or selected success.')
    }
    return { status: 'skipped', attempts: 0 }
  }
  if (active.kind === 'branch') {
    if (active.readinessAttemptSequence === undefined) return { status: 'missing', attempts: 0 }
    const readiness = projection.readinessAttempts.find((attempt) => attempt.sequence === active.readinessAttemptSequence)
    if (!readiness || readiness.branchPlanId !== active.branchPlanId) throw UsageError('Active branch readiness pointer does not resolve exactly once.')
    return readiness.admissionDisposition === 'eligible'
      ? { status: 'missing', attempts: 0 }
      : { status: 'failed', attempts: 0 }
  }
  const render = projection.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
  const event = render?.events.find((entry) => entry.sequence === active.eventSequence)
  if (!event) throw UsageError('Active render event pointer does not resolve exactly once.')
  return { status: event.status, attempts: event.attempt }
}

export const validateHybridRepairDependencies = (
  repair: HybridRepairDependencies
): HybridRepairDependencies => {
  if (repair.schemaVersion !== 1 || repair.reusedOutputs.length === 0 || repair.resubmittedTurnIds.length === 0) {
    throw UsageError('Hybrid repair requires versioned reused output and resubmitted turn sets.')
  }
  assertUnique(repair.resubmittedTurnIds, 'Hybrid resubmitted turn IDs')
  const reusedOutputIds = repair.reusedOutputs.map((output) => `${output.baseBatchResultId}\0${output.outputId}`)
  assertUnique(reusedOutputIds, 'Hybrid reused output identities')
  const reusedTurnIds = repair.reusedOutputs.flatMap((output) => output.sourceTurnIds)
  if (reusedTurnIds.some((turnId) => repair.resubmittedTurnIds.includes(turnId))) {
    throw UsageError('Hybrid repair cannot both reuse and resubmit the same source turn.')
  }
  for (const output of repair.reusedOutputs) {
    if (output.coveredCanonicalRanges.length === 0) throw UsageError('Hybrid reused output requires covered canonical ranges.')
    for (const range of output.coveredCanonicalRanges) {
      if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end <= range.start) {
        throw UsageError('Hybrid canonical ranges must be non-empty zero-based half-open intervals.')
      }
      for (const [value, label] of [
        [range.canonicalTextSliceHash, 'canonical text'],
        [range.preparedProviderTextSliceHash, 'prepared provider text'],
        [range.bindingIdentityHash, 'binding identity'],
        [range.providerControlsHash, 'provider controls'],
        [range.requestedOutputHash, 'requested output']
      ] as const) assertSha256(value, `Hybrid ${label} hash`)
    }
  }
  return repair
}

export { capabilityFeatureForStrategy } from './render-plan-header-validation'
