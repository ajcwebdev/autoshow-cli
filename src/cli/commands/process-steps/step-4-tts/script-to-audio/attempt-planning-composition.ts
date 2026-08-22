import type { CanonicalAudioProviderProjection, CreateCurrentTtsRenderAttemptOptions, PipelineProviderState, PlannedInputs, PureCurrentTtsReadinessPlan, PureCurrentTtsRenderPlan, PureCurrentTtsRenderPlanOptions, ProviderRenderBranchCandidate, ProviderRenderBranchPlan, ProviderRenderPlan, ProviderRenderStrategy, SanitizedProviderError, TtsTarget } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTargetKey, canonicalTtsJson, computeRenderIdentity, computeVoiceContextKey, hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import { projectCanonicalAudioProviderStatus, validateProviderRenderPlanIdentity } from './contract-validation'
import { SCHEMA_VERSION, withIdentity } from './attempt-shared'
import { prepareSegmentedTurnText } from './comic-segmented-audio'
import { bindingIdentityHash, buildCapabilityFixture, requestedOutput, sumCosts } from './attempt-planning-shared'
import { planComicInputs } from './attempt-planning-comic'
import { planGenericInputs } from './attempt-planning-generic'

export const planInputs = (options: CreateCurrentTtsRenderAttemptOptions, capabilityFixtureHash: string): PlannedInputs => {
  return options.comicContext
    ? planComicInputs(options, capabilityFixtureHash)
    : planGenericInputs(options, capabilityFixtureHash)
}


export const buildPureCurrentTtsRenderPlan = (options: PureCurrentTtsRenderPlanOptions): PureCurrentTtsRenderPlan => {
  const operation = options.comicContext ? 'comic-audio' as const : 'tts-synthesis' as const
  if (options.target.operation && options.target.operation !== operation) throw CLIUsageError('TTS target operation does not match its render context.')
  const transport = options.target.transport ?? 'hosted-api'
  const targetKey = options.target.targetKey ?? canonicalTargetKey(operation, options.target.service, options.target.model, transport)
  const capabilitySeed = hashCanonicalTtsValue({ schemaVersion: 1, provider: options.target.service, model: options.target.model, transport, adapterSchemaVersion: SCHEMA_VERSION })
  const draft = planInputs({ ...options, outputDir: '.' }, capabilitySeed)
  const capability = buildCapabilityFixture(options.target, transport, draft.strategy)
  const capabilityFixtureHash = capability.capabilityFixtureHash
  const capabilityScopeHash = capability.capabilityScopeHash
  const planned = planInputs({ ...options, outputDir: '.' }, capabilityFixtureHash)
  const voiceContext = options.comicContext
    ? { kind: 'approved-snapshot' as const, snapshotId: options.comicContext.voiceSnapshot.snapshotId }
    : { kind: 'transient' as const, bindingIdentityHashes: planned.turns.map(turn => bindingIdentityHash(turn.binding)) }
  const voiceContextKey = computeVoiceContextKey(options.comicContext
    ? { kind: 'approved-snapshot', snapshotId: options.comicContext.voiceSnapshot.snapshotId }
    : { kind: 'transient', turns: planned.turns.map((turn) => ({ turnId: turn.canonical.turnId, bindingIdentityHash: bindingIdentityHash(turn.binding) })) })
  const requestedAudioOutput = requestedOutput(options)
  const outputProfileHash = hashCanonicalTtsValue(requestedAudioOutput)
  const synthesisSettingsHash = hashCanonicalTtsValue({
    nodes: planned.turns.map((turn) => ({
      turnId: turn.canonical.turnId,
      voiceSynthesisSettings: turn.binding.synthesisSettings,
      providerControls: turn.controls,
      ...(turn.canonical.delivery ? { providerDelivery: { schemaVersion: 1, settingsSchema: 'generic-tts.delivery.v1', values: { description: turn.canonical.delivery.description, disposition: options.comicContext?.deliveryDispositionByTurnId?.[turn.canonical.turnId] ?? 'serialized' } } } : {})
    })),
    batchRequestControls: planned.batches.map((batch) => ({ batchId: batch.batchId, requestControls: batch.requestControls }))
  })
  const plannedRenderCost = sumCosts(planned.slots.map((slot) => slot.plannedCost))
  const resolvedTurnById = new Map(planned.turns.map((turn) => [turn.canonical.turnId, {
    ...turn.canonical,
    providerText: prepareSegmentedTurnText(turn.canonical.canonicalText, options.target, turn.canonical.delivery?.description),
    voice: turn.binding,
    providerControls: turn.controls,
    ...(turn.canonical.delivery ? { providerDelivery: { schemaVersion: 1 as const, settingsSchema: 'generic-tts.delivery.v1', values: { description: turn.canonical.delivery.description, disposition: options.comicContext?.deliveryDispositionByTurnId?.[turn.canonical.turnId] ?? 'serialized' } } } : {})
  }] as const))
  const resolvedNodes = planned.dialoguePlan.nodes.map((node) => {
    if (node.kind === 'turn') {
      const turn = resolvedTurnById.get(node.turn.turnId)
      if (!turn) throw CLIUsageError(`Provider render plan lost dialogue turn ${node.turn.turnId}.`)
      return { kind: 'turn' as const, turn }
    }
    const turns = node.turns.map((sourceTurn) => {
      const turn = resolvedTurnById.get(sourceTurn.turnId)
      if (!turn) throw CLIUsageError(`Provider render plan lost overlap turn ${sourceTurn.turnId}.`)
      return turn
    })
    return { kind: 'overlap' as const, groupId: node.groupId, turns }
  })
  const branchCandidate = withIdentity({
    strategy: planned.strategy,
    requiredCapabilityScopeHashes: [capabilityScopeHash],
    batchSketches: planned.batches.map((batch) => ({
      orderedTurnIds: batch.orderedTurnIds,
      requestControlsHash: hashCanonicalTtsValue(batch.requestControls),
      generationSlots: batch.generationSlots.map((slot) => ({ slotIndex: slot.slotIndex, requestedTakeCount: slot.requestedTakeCount, plannedCost: slot.plannedCost })),
      takeSelectionPolicy: batch.takeSelectionPolicy,
      continuationPlanHash: hashCanonicalTtsValue(batch.continuation)
    })),
    requestedOutputHash: outputProfileHash,
    plannedCost: plannedRenderCost
  }, 'candidateId') as unknown as ProviderRenderBranchCandidate
  const branchPlan = withIdentity({
    schemaVersion: 1 as const,
    operation,
    dialoguePlanId: planned.dialoguePlan.dialoguePlanId,
    sourceIdentityHash: planned.sourceIdentity.identityHash,
    targetKey,
    voiceContextKey,
    voiceContext,
    provider: options.target.service,
    model: options.target.model,
    transport,
    modePreference: options.comicContext?.modePreference ?? 'auto' as const,
    candidateStrategies: [branchCandidate],
    synthesisSettingsHash,
    outputProfileHash,
    capabilityFixtureHash
  }, 'branchPlanId') as unknown as ProviderRenderBranchPlan
  const textArtifactSha = (value: string): string => sha256Bytes(value.endsWith('\n') ? value : `${value}\n`)
  const jsonArtifactSha = (value: unknown): string => sha256Bytes(`${canonicalTtsJson(value)}\n`)
  const strategyArtifacts = {
    sourceIdentity: { identityHash: planned.sourceIdentity.identityHash, path: 'source-identity.json', sha256: jsonArtifactSha(planned.sourceIdentity) },
    dialoguePlan: { dialoguePlanId: planned.dialoguePlan.dialoguePlanId, path: 'dialogue-plan.json', sha256: jsonArtifactSha(planned.dialoguePlan) },
    normalizedDialogue: { path: 'strategy/dialogue-normalized.txt', sha256: textArtifactSha(planned.normalizedText) },
    turns: planned.turns.map((turn) => ({ turnId: turn.canonical.turnId, path: `strategy/turns/${turn.canonical.turnId}.txt`, sha256: textArtifactSha(turn.canonical.canonicalText) })),
    generationSlots: planned.slots.map((slot) => ({ generationSlotId: slot.generationSlotId, path: `strategy/generation-slots/${slot.generationSlotId}.txt`, sha256: textArtifactSha(slot.providerText) }))
  }
  const planBase = {
    schemaVersion: 1 as const,
    branchPlanId: branchPlan.branchPlanId,
    branchCandidateId: branchCandidate.candidateId,
    operation,
    dialoguePlanId: planned.dialoguePlan.dialoguePlanId,
    sourceIdentityHash: planned.sourceIdentity.identityHash,
    targetKey,
    voiceContextKey,
    provider: options.target.service,
    model: options.target.model,
    transport,
    synthesisSettingsHash,
    outputProfileHash,
    capabilityFixtureHash,
    requiredCapabilityScopeHashes: [capabilityScopeHash],
    resolvedVoiceRevisionHashes: planned.turns.flatMap(turn => turn.binding.kind === 'approved-snapshot' && turn.binding.providerRevision ? [hashCanonicalTtsValue(turn.binding.providerRevision)] : []),
    requestedOutput: requestedAudioOutput,
    batches: planned.batches,
    plannedCost: plannedRenderCost,
    strategyArtifacts,
    nodes: resolvedNodes,
    strategy: planned.strategy,
    voiceContext: branchPlan.voiceContext
  }
  const renderPlanId = hashCanonicalTtsValue(planBase)
  const renderIdentity = computeRenderIdentity({ renderPlanId, targetKey, strategy: planned.strategy, voiceContextKey, synthesisSettingsHash, outputProfileHash })
  const renderPlan = { ...planBase, renderPlanId, renderIdentity } as ProviderRenderPlan
  validateProviderRenderPlanIdentity(renderPlan)
  return { operation, transport, targetKey, capability, capabilityFixtureHash, capabilityScopeHash, planned, voiceContextKey, outputProfileHash, synthesisSettingsHash, plannedRenderCost, branchCandidate, branchPlan, strategyArtifacts, renderPlanId, renderIdentity, renderPlan }
}

export const validateCurrentTtsRenderAttemptInputs = (
  options: Omit<CreateCurrentTtsRenderAttemptOptions, 'outputDir' | 'artifactRoot' | 'onProviderState' | 'priorAttemptCount' | 'recoveredSlots' | 'retainedCumulativePlannedCost' | 'now'>
): void => {
  buildPureCurrentTtsRenderPlan(options)
}

export const planCurrentTtsRenderIdentity = (
  options: PureCurrentTtsRenderPlanOptions
): { branchPlanId: string, renderPlanId: string, renderIdentity: string, targetKey: string, strategy: ProviderRenderStrategy } => {
  const planned = buildPureCurrentTtsRenderPlan(options)
  return { branchPlanId: planned.branchPlan.branchPlanId, renderPlanId: planned.renderPlanId, renderIdentity: planned.renderIdentity, targetKey: planned.targetKey, strategy: planned.planned.strategy }
}

export const planCurrentTtsReadiness = (
  options: PureCurrentTtsRenderPlanOptions
): PureCurrentTtsReadinessPlan => {
  const planned = buildPureCurrentTtsRenderPlan(options)
  return {
    operation: planned.operation,
    transport: planned.transport,
    targetKey: planned.targetKey,
    capability: planned.capability,
    capabilityFixtureHash: planned.capabilityFixtureHash,
    capabilityScopeHash: planned.capabilityScopeHash,
    branchCandidate: planned.branchCandidate as ProviderRenderBranchCandidate,
    branchPlan: planned.branchPlan as ProviderRenderBranchPlan,
    renderPlan: planned.renderPlan,
    renderPlanId: planned.renderPlanId,
    renderIdentity: planned.renderIdentity,
    strategy: planned.planned.strategy,
    plannedCost: planned.plannedRenderCost
  }
}

export const stateForProjection = (
  target: TtsTarget,
  targetKey: string,
  transport: string,
  artifactDir: string,
  projection: CanonicalAudioProviderProjection,
  error?: SanitizedProviderError | undefined
): PipelineProviderState => {
  const projected = projectCanonicalAudioProviderStatus(projection)
  const operation = target.operation ?? 'tts-synthesis'
  const namespace = operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return {
    service: target.service,
    model: target.model,
    local: false,
    operation,
    targetKey,
    transport,
    artifactDir,
    status: projected.status,
    attempts: projected.attempts,
    options: {},
    metadata: { [namespace]: projection },
    result: { [namespace]: projection },
    ...(error ? { error } : {})
  }
}

export const readAudioProjection = (state: PipelineProviderState): CanonicalAudioProviderProjection | undefined => {
  const namespace = state.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return state.result?.[namespace] as CanonicalAudioProviderProjection | undefined
}

export const readAudioMetadataProjection = (state: PipelineProviderState): CanonicalAudioProviderProjection | undefined => {
  const namespace = state.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return state.metadata[namespace] as CanonicalAudioProviderProjection | undefined
}
