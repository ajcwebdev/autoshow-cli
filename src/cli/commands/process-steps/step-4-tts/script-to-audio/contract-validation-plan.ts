import type { CanonicalAudioProviderProjection, HybridRepairDependencies, ProviderRenderPlan, VoiceCapabilityFeature } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTargetKey, computeRenderIdentity, computeVoiceContextKey, hashCanonicalRecordWithout, hashCanonicalTtsValue } from './contract-identity'
import { assertExactStringSet, assertSha256, assertUnique, SHA256, validatePlannedCost, validateTypedSettings } from './contract-validation-primitives'
import { validatePreparedProviderText, validateProviderVoiceRef } from './contract-validation-capability'

export const capabilityFeatureForStrategy = (strategy: ProviderRenderPlan['strategy']): VoiceCapabilityFeature => {
  if (strategy === 'native-dialogue') return 'native-dialogue'
  if (strategy === 'native-utterances') return 'native-utterances'
  return 'turn-synthesis'
}

export const validateProviderRenderPlanIdentity = (plan: ProviderRenderPlan): ProviderRenderPlan => {
  if (plan.schemaVersion !== 1) throw CLIUsageError('Provider render plan requires schemaVersion 1.')
  const expectedTarget = canonicalTargetKey(plan.operation, plan.provider, plan.model, plan.transport)
  if (plan.targetKey !== expectedTarget) throw CLIUsageError('Provider render plan targetKey does not match its operation/adapter identity.')
  const expectedPlanId = hashCanonicalRecordWithout(plan as unknown as Record<string, unknown>, ['renderPlanId', 'renderIdentity'])
  if (plan.renderPlanId !== expectedPlanId) throw CLIUsageError('Provider render plan has an invalid renderPlanId.')
  const expectedRenderIdentity = computeRenderIdentity({
    renderPlanId: plan.renderPlanId,
    targetKey: plan.targetKey,
    strategy: plan.strategy,
    voiceContextKey: plan.voiceContextKey,
    synthesisSettingsHash: plan.synthesisSettingsHash,
    outputProfileHash: plan.outputProfileHash
  })
  if (plan.renderIdentity !== expectedRenderIdentity) {
    throw CLIUsageError('Provider render plan has an invalid voice-aware renderIdentity.')
  }
  const feature = capabilityFeatureForStrategy(plan.strategy)
  if (
    plan.requiredCapabilityScopeHashes.length === 0
    || plan.requiredCapabilityScopeHashes.some((hash) => !SHA256.test(hash))
    || !SHA256.test(plan.capabilityFixtureHash)
    || !SHA256.test(plan.synthesisSettingsHash)
    || !SHA256.test(plan.outputProfileHash)
    || plan.outputProfileHash !== hashCanonicalTtsValue(plan.requestedOutput)
  ) {
    throw CLIUsageError(`Provider render plan requires valid ${feature} capability, settings, and output identities.`)
  }
  assertUnique(plan.requiredCapabilityScopeHashes, 'Provider render capability scopes')
  assertUnique(plan.resolvedVoiceRevisionHashes, 'Provider render voice revisions')
  if (plan.batches.length === 0 || plan.batches.some((batch) => batch.generationSlots.length === 0)) {
    throw CLIUsageError('Provider render plan requires non-empty batches and generation slots.')
  }
  if (!plan.requestedOutput.codec.trim() || !plan.requestedOutput.container.trim()) {
    throw CLIUsageError('Provider render plan requires a concrete requested audio codec and container.')
  }
  validatePlannedCost(plan.plannedCost, 'Provider render planned cost')

  const turns = plan.nodes.flatMap((node) => node.kind === 'turn' ? [node.turn] : node.turns)
  if (turns.length === 0) throw CLIUsageError('Provider render plan requires speakable resolved turns.')
  if (plan.nodes.some(node => node.kind === 'overlap' && (!node.groupId.trim() || node.turns.length < 2))) throw CLIUsageError('Provider render overlap nodes require a stable group ID and at least two resolved turns.')
  assertUnique(turns.map((turn) => turn.turnId), 'Provider render turn IDs')
  for (const turn of turns) {
    if (!turn.turnId.trim() || !turn.sourceSegmentId.trim() || !turn.subjectKey.trim() || !turn.originalSpeakerLabel.trim() || !turn.canonicalText.trim()) {
      throw CLIUsageError('Provider render turn identity and canonical text must not be empty.')
    }
    validatePreparedProviderText(turn.providerText)
    if (turn.providerText.canonicalText !== turn.canonicalText) {
      throw CLIUsageError('Prepared provider text must bind the exact canonical turn text.')
    }
    validateTypedSettings(turn.providerControls, 'Provider turn controls')
    if (turn.providerDelivery) validateTypedSettings(turn.providerDelivery, 'Provider turn delivery')
    validateProviderVoiceRef(turn.voice.providerVoice)
    if (turn.voice.providerVoice.provider !== plan.provider || turn.voice.providerModel !== plan.model) {
      throw CLIUsageError('Resolved voice binding does not match the provider render target.')
    }
    if (turn.voice.settingsSchema !== turn.voice.synthesisSettings.settingsSchema) {
      throw CLIUsageError('Resolved voice settings schema does not match its synthesis settings payload.')
    }
    validateTypedSettings(turn.voice.synthesisSettings, 'Resolved voice synthesis settings')
  }

  const batchIds = plan.batches.map((batch) => batch.batchId)
  assertUnique(batchIds, 'Provider render batch IDs')
  const slotIds = plan.batches.flatMap((batch) => batch.generationSlots.map((slot) => slot.generationSlotId))
  assertUnique(slotIds, 'Provider render generation slot IDs')
  const orderedTurnIds = plan.batches.flatMap((batch) => batch.orderedTurnIds)
  if (plan.strategy !== 'hybrid') {
    assertExactStringSet(orderedTurnIds, turns.map((turn) => turn.turnId), 'Provider render batch turn coverage')
  } else if (orderedTurnIds.some((turnId) => !turns.some((turn) => turn.turnId === turnId))) {
    throw CLIUsageError('Hybrid provider render batch references an unknown turn.')
  }
  for (const [batchIndex, batch] of plan.batches.entries()) {
    if (batch.orderedTurnIds.length === 0) throw CLIUsageError('Provider render batch requires ordered turns.')
    assertUnique(batch.orderedTurnIds, 'Provider render batch turn IDs')
    validateTypedSettings(batch.requestControls, 'Provider batch request controls')
    validatePlannedCost(batch.plannedCost, 'Provider batch planned cost')
    if (batch.generationSlots.some((slot, index) =>
      slot.slotIndex !== index
      || !Number.isInteger(slot.requestedTakeCount)
      || slot.requestedTakeCount < 1
    )) {
      throw CLIUsageError('Provider generation slots require contiguous zero-based indexes and positive take counts.')
    }
    for (const slot of batch.generationSlots) validatePlannedCost(slot.plannedCost, 'Provider generation-slot planned cost')
    if (batch.continuation.kind === 'prior-batch-selection') {
      const predecessorBatchId = batch.continuation.predecessorBatchId
      const predecessorIndex = plan.batches.findIndex((entry) => entry.batchId === predecessorBatchId)
      if (predecessorIndex < 0 || predecessorIndex >= batchIndex) {
        throw CLIUsageError('Provider continuation must reference an earlier batch in the same render plan.')
      }
    }
  }

  if (plan.voiceContext.kind === 'approved-snapshot') {
    const snapshotId = plan.voiceContext.snapshotId
    if (
      turns.some((turn) => turn.voice.kind !== 'approved-snapshot' || turn.voice.snapshotId !== snapshotId)
      || plan.voiceContextKey !== computeVoiceContextKey(plan.voiceContext)
    ) {
      throw CLIUsageError('Approved provider render voice context key does not match its snapshot.')
    }
  } else {
    const transientTurns = turns.map((turn) => {
      if (turn.voice.kind !== 'transient-provider-voice') {
        throw CLIUsageError('Transient provider render context requires only transient voice bindings.')
      }
      return { turnId: turn.turnId, bindingIdentityHash: turn.voice.identityHash }
    })
    const declaredBindingIdentities = [...plan.voiceContext.bindingIdentityHashes].sort()
    const actualBindingIdentities = transientTurns.map((turn) => turn.bindingIdentityHash).sort()
    if (
      declaredBindingIdentities.length !== actualBindingIdentities.length
      || declaredBindingIdentities.some((identity, index) => identity !== actualBindingIdentities[index])
    ) {
      throw CLIUsageError('Provider render transient binding identities must exactly match its turn bindings.')
    }
    if (plan.voiceContextKey !== computeVoiceContextKey({ kind: 'transient', turns: transientTurns })) {
      throw CLIUsageError('Transient provider render voice context key does not match its exact turn bindings.')
    }
  }
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
  if (!active) throw CLIUsageError('New audio provider projection requires activeWork.')
  if (active.kind === 'policy-skip') {
    if (projection.branchHistory.length > 0 || projection.readinessAttempts.length > 0 || projection.renderHistory.length > 0 || projection.selectedSuccess) {
      throw CLIUsageError('Policy skip is valid only before any provider work or selected success.')
    }
    return { status: 'skipped', attempts: 0 }
  }
  if (active.kind === 'branch') {
    if (active.readinessAttemptSequence === undefined) return { status: 'missing', attempts: 0 }
    const readiness = projection.readinessAttempts.find((attempt) => attempt.sequence === active.readinessAttemptSequence)
    if (!readiness || readiness.branchPlanId !== active.branchPlanId) throw CLIUsageError('Active branch readiness pointer does not resolve exactly once.')
    return readiness.admissionDisposition === 'eligible'
      ? { status: 'missing', attempts: 0 }
      : { status: 'failed', attempts: 0 }
  }
  const render = projection.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
  const event = render?.events.find((entry) => entry.sequence === active.eventSequence)
  if (!event) throw CLIUsageError('Active render event pointer does not resolve exactly once.')
  return { status: event.status, attempts: event.attempt }
}


export const validateHybridRepairDependencies = (
  repair: HybridRepairDependencies
): HybridRepairDependencies => {
  if (repair.schemaVersion !== 1 || repair.reusedOutputs.length === 0 || repair.resubmittedTurnIds.length === 0) {
    throw CLIUsageError('Hybrid repair requires versioned reused output and resubmitted turn sets.')
  }
  assertUnique(repair.resubmittedTurnIds, 'Hybrid resubmitted turn IDs')
  const reusedOutputIds = repair.reusedOutputs.map((output) => `${output.baseBatchResultId}\0${output.outputId}`)
  assertUnique(reusedOutputIds, 'Hybrid reused output identities')
  const reusedTurnIds = repair.reusedOutputs.flatMap((output) => output.sourceTurnIds)
  if (reusedTurnIds.some((turnId) => repair.resubmittedTurnIds.includes(turnId))) {
    throw CLIUsageError('Hybrid repair cannot both reuse and resubmit the same source turn.')
  }
  for (const output of repair.reusedOutputs) {
    if (output.coveredCanonicalRanges.length === 0) throw CLIUsageError('Hybrid reused output requires covered canonical ranges.')
    for (const range of output.coveredCanonicalRanges) {
      if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end <= range.start) {
        throw CLIUsageError('Hybrid canonical ranges must be non-empty zero-based half-open intervals.')
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
