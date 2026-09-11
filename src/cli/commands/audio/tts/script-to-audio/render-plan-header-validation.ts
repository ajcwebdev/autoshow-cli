import type { ProviderRenderPlan, VoiceCapabilityFeature } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { SEGMENTED_COMPOSITION_VERSION } from './attempt-shared'
import { canonicalTargetKey, computeRenderIdentity, hashCanonicalRecordWithout, hashCanonicalTtsValue } from './contract-identity'
import { assertUnique, SHA256, validatePlannedCost } from './contract-validation-primitives'

export const capabilityFeatureForStrategy = (strategy: ProviderRenderPlan['strategy']): VoiceCapabilityFeature => {
  if (strategy === 'native-dialogue') return 'native-dialogue'
  if (strategy === 'native-utterances') return 'native-utterances'
  return 'turn-synthesis'
}

export const validateRenderPlanHeader = (plan: ProviderRenderPlan): void => {
  if (plan.schemaVersion !== 1) throw UsageError('Provider render plan requires schemaVersion 1.')
  const expectedTarget = canonicalTargetKey(plan.operation, plan.provider, plan.model, plan.transport)
  if (plan.targetKey !== expectedTarget) throw UsageError('Provider render plan targetKey does not match its operation/adapter identity.')
  const expectedPlanId = hashCanonicalRecordWithout(plan as unknown as Record<string, unknown>, ['renderPlanId', 'renderIdentity'])
  if (plan.renderPlanId !== expectedPlanId) throw UsageError('Provider render plan has an invalid renderPlanId.')
  const expectedRenderIdentity = computeRenderIdentity({
    renderPlanId: plan.renderPlanId,
    targetKey: plan.targetKey,
    strategy: plan.strategy,
    voiceContextKey: plan.voiceContextKey,
    synthesisSettingsHash: plan.synthesisSettingsHash,
    outputProfileHash: plan.outputProfileHash
  })
  if (plan.renderIdentity !== expectedRenderIdentity) {
    throw UsageError('Provider render plan has an invalid voice-aware renderIdentity.')
  }
  const feature = capabilityFeatureForStrategy(plan.strategy)
  const legacyOutputProfileHash = hashCanonicalTtsValue(plan.requestedOutput)
  const currentOutputProfileHash = hashCanonicalTtsValue({ requestedOutput: plan.requestedOutput, compositionVersion: SEGMENTED_COMPOSITION_VERSION })
  if (
    plan.requiredCapabilityScopeHashes.length === 0
    || plan.requiredCapabilityScopeHashes.some((hash) => !SHA256.test(hash))
    || !SHA256.test(plan.capabilityFixtureHash)
    || !SHA256.test(plan.synthesisSettingsHash)
    || !SHA256.test(plan.outputProfileHash)
    || (plan.outputProfileHash !== legacyOutputProfileHash && (plan.strategy !== 'segmented' || plan.outputProfileHash !== currentOutputProfileHash))
  ) {
    throw UsageError(`Provider render plan requires valid ${feature} capability, settings, and output identities.`)
  }
  assertUnique(plan.requiredCapabilityScopeHashes, 'Provider render capability scopes')
  assertUnique(plan.resolvedVoiceRevisionHashes, 'Provider render voice revisions')
  if (plan.batches.length === 0 || plan.batches.some((batch) => batch.generationSlots.length === 0)) {
    throw UsageError('Provider render plan requires non-empty batches and generation slots.')
  }
  if (!plan.requestedOutput.codec.trim() || !plan.requestedOutput.container.trim()) {
    throw UsageError('Provider render plan requires a concrete requested audio codec and container.')
  }
  validatePlannedCost(plan.plannedCost, 'Provider render planned cost')
}
