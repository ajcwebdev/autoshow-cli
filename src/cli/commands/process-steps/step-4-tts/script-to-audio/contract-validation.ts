import type {
  AccountCapabilityObservation,
  AnyCapabilityRecord,
  CanonicalAudioProviderProjection,
  CacheMaterializationPlan,
  HybridRepairDependencies,
  GenericTtsDialoguePlan,
  GenericTtsSourceIdentity,
  NormalizedTiming,
  PreparedProviderText,
  PreparedProviderTextSpan,
  ProviderQualifiedCast,
  ProviderRenderPlan,
  ProviderBatchResult,
  ProviderRenderResult,
  ObservedProviderRequest,
  RenderAdmissionJournalSnapshot,
  ProviderVoiceRef,
  TimedToken,
  TimingClock,
  VoiceCapabilityFeature,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { assertContentIdentity, assertSafeArtifactRelativePath, canonicalTargetKey, canonicalTtsJson, computeRenderIdentity, computeVoiceContextKey, hashCanonicalRecordWithout, hashCanonicalTtsValue } from './contract-identity'

const SHA256 = /^[a-f0-9]{64}$/

const assertSha256 = (value: string, label: string): void => {
  if (!SHA256.test(value)) throw CLIUsageError(`${label} must be a lowercase SHA-256 digest.`)
}

const assertIsoDate = (value: string, label: string): void => {
  if (Number.isNaN(Date.parse(value))) throw CLIUsageError(`${label} must be an ISO date-time.`)
}

const assertUnique = (values: readonly string[], label: string): void => {
  if (new Set(values).size !== values.length) throw CLIUsageError(`${label} contains duplicate values.`)
}

const assertExactStringSet = (
  actual: readonly string[],
  expected: readonly string[],
  label: string
): void => {
  assertUnique(actual, label)
  assertUnique(expected, `${label} expectation`)
  const expectedValues = new Set(expected)
  if (actual.length !== expected.length || actual.some((value) => !expectedValues.has(value))) {
    throw CLIUsageError(`${label} must exactly cover its requested identities.`)
  }
}

const validatePlannedCost = (cost: { amounts: Array<{ amount: number, currency: string }> }, label: string): void => {
  if (!Array.isArray(cost.amounts)) throw CLIUsageError(`${label} requires an amount list.`)
  for (const amount of cost.amounts) {
    if (!Number.isFinite(amount.amount) || amount.amount < 0 || !amount.currency.trim()) {
      throw CLIUsageError(`${label} contains an invalid non-negative currency amount.`)
    }
  }
}

const validateObservedCost = (amounts: Array<{ amount: number, currency: string }>, label: string): void => {
  for (const amount of amounts) {
    if (!Number.isFinite(amount.amount) || amount.amount < 0 || !amount.currency.trim()) {
      throw CLIUsageError(`${label} contains an invalid non-negative currency amount.`)
    }
  }
}

const validatePlannedAndObservedCost = (
  cost: { planned: { amounts: Array<{ amount: number, currency: string }> }, observed: Array<{ amount: number, currency: string }> },
  label: string
): void => {
  validatePlannedCost(cost.planned, `${label} planned cost`)
  validateObservedCost(cost.observed, `${label} observed cost`)
}

const validateTypedSettings = (
  settings: { schemaVersion: 1, settingsSchema: string, values: Record<string, unknown> },
  label: string
): void => {
  if (settings.schemaVersion !== 1 || !settings.settingsSchema.trim() || !isRecordValue(settings.values)) {
    throw CLIUsageError(`${label} requires schemaVersion 1, a settings schema, and values.`)
  }
  for (const value of Object.values(settings.values)) {
    if (
      value !== null
      && typeof value !== 'string'
      && typeof value !== 'number'
      && typeof value !== 'boolean'
      && !(Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
    ) {
      throw CLIUsageError(`${label} contains an unsupported setting value.`)
    }
  }
}

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const validateObservedProviderRequest = (request: ObservedProviderRequest): void => {
  if (
    !Number.isInteger(request.requestOrdinal)
    || request.requestOrdinal < 1
    || !request.invocationId.trim()
    || !request.batchId.trim()
    || !request.generationSlotId.trim()
    || !request.batchInvocationPlanId.trim()
    || !request.model.trim()
    || !request.transport.trim()
    || !request.endpointKind.trim()
    || !request.serializerVersion.trim()
    || !SHA256.test(request.requestBodyHash)
    || !SHA256.test(request.actualRequestControlsHash)
    || !SHA256.test(request.actualContinuationHash)
    || request.turns.length === 0
  ) {
    throw CLIUsageError('Observed provider request requires complete serializer identity and request hashes.')
  }
  assertUnique(request.turns.map((turn) => turn.turnId), 'Observed provider request turn IDs')
  for (const turn of request.turns) {
    if (
      !turn.turnId.trim()
      || !turn.voiceField.trim()
      || !SHA256.test(turn.providerTextHash)
      || !SHA256.test(turn.actualSerializedVoice.valueHash)
      || turn.actualSerializedVoice.provider !== request.provider
      || !SHA256.test(turn.actualSerializedControlsHash)
      || (turn.actualSerializedDeliveryHash !== undefined && !SHA256.test(turn.actualSerializedDeliveryHash))
    ) {
      throw CLIUsageError('Observed provider request turn has invalid text, voice, control, or delivery evidence.')
    }
  }
  if (request.acceptedAt !== undefined) assertIsoDate(request.acceptedAt, 'Observed provider request acceptance')
}

export const validateProviderVoiceRef = (voice: ProviderVoiceRef): ProviderVoiceRef => {
  if (voice.kind === 'remote-resource') {
    if (!voice.resourceId.trim()) throw CLIUsageError('Remote voice resource ID must not be empty.')
    if (voice.namespace === 'account' && !voice.accountScopeHash) {
      throw CLIUsageError('Account-namespaced voice requires accountScopeHash.')
    }
    if (voice.namespace === 'provider' && voice.accountScopeHash !== undefined) {
      throw CLIUsageError('Provider-namespaced voice forbids accountScopeHash.')
    }
  } else if (voice.kind === 'reference-asset') {
    assertSha256(voice.protectedAsset.sha256, 'Protected voice asset checksum')
    if (!voice.authorizationRef.trim()) throw CLIUsageError('Reference voice requires an authorization reference.')
  } else if (voice.kind === 'local-model-voice') {
    if (!voice.model.trim() || !voice.voiceLocator.trim()) throw CLIUsageError('Local voice requires model and locator values.')
  }
  return voice
}

export const validateCapabilityRecord = (record: AnyCapabilityRecord): AnyCapabilityRecord => {
  if (record.channel === 'unsupported') {
    if (record.maturity !== 'not-applicable' || record.adapterSupport !== 'unsupported') {
      throw CLIUsageError('Unsupported capability channel requires not-applicable maturity and unsupported adapter support.')
    }
  } else if (record.maturity === 'not-applicable') {
    throw CLIUsageError('A supported capability channel cannot have not-applicable maturity.')
  }
  if (record.adapterSupport === 'implemented' && record.channel === 'ui-only') {
    throw CLIUsageError('A UI-only capability cannot be implemented as an API adapter facet.')
  }
  assertIsoDate(record.documentationEvidence.checkedAt, 'Capability evidence checkedAt')
  if (record.documentationEvidence.sourceRefs.length === 0 || record.documentationEvidence.sourceRefs.some((ref) => !ref.trim())) {
    throw CLIUsageError('Capability evidence requires non-empty source references.')
  }
  assertContentIdentity(
    record.documentationEvidence as unknown as Record<string, unknown>,
    'evidenceHash',
    `${record.scope.provider}/${record.scope.feature} documentation evidence`
  )
  return record
}

export const validateCapabilityFacetSet = (records: readonly AnyCapabilityRecord[]): void => {
  const scopes = records.map((record) => `${record.scope.provider}\0${record.scope.feature}\0${record.scope.model ?? ''}\0${record.scope.transport ?? ''}`)
  assertUnique(scopes, 'Capability fixture scopes')
  for (const record of records) validateCapabilityRecord(record)
}

export const validateAccountCapabilityObservation = (
  observation: AccountCapabilityObservation,
  expected: { capabilityScopeHash?: string | undefined, capabilityFixtureHash?: string | undefined, accountScopeHash?: string | undefined } = {}
): AccountCapabilityObservation => {
  assertContentIdentity(observation as unknown as Record<string, unknown>, 'observationHash', 'Account capability observation')
  assertIsoDate(observation.checkedAt, 'Account capability observation checkedAt')
  if (observation.expiresAt) {
    assertIsoDate(observation.expiresAt, 'Account capability observation expiresAt')
    if (Date.parse(observation.expiresAt) <= Date.parse(observation.checkedAt)) {
      throw CLIUsageError('Account capability observation expiry must follow checkedAt.')
    }
  }
  if (observation.state === 'available' && observation.unmetRequirements.length > 0) {
    throw CLIUsageError('Available account capability cannot have unmet requirements.')
  }
  if (observation.state !== 'available' && observation.satisfiedRequirements.length > 0 && observation.unmetRequirements.length === 0) {
    throw CLIUsageError('Non-available account capability must retain an unmet requirement or an empty requirement set.')
  }
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (expectedValue !== undefined && observation[key as keyof AccountCapabilityObservation] !== expectedValue) {
      throw CLIUsageError(`Account capability observation has a mismatched ${key}.`)
    }
  }
  return observation
}

export const validateProviderQualifiedCast = (cast: ProviderQualifiedCast): ProviderQualifiedCast => {
  if (cast.schemaVersion !== 1 || cast.targets.length === 0) {
    throw CLIUsageError('Provider-qualified cast must use schemaVersion 1 and contain at least one target.')
  }
  const targetKeys = cast.targets.map((target) => canonicalTargetKey('tts-synthesis', target.provider, target.model, target.transport))
  assertUnique(targetKeys, 'Provider-qualified cast targets')
  for (const target of cast.targets) {
    if (target.bindings.length === 0) throw CLIUsageError('Every provider-qualified cast target requires bindings.')
    assertUnique(target.bindings.map((binding) => binding.speakerKey), 'Provider-qualified cast speaker keys')
    for (const binding of target.bindings) {
      if (!binding.speakerKey.trim()) throw CLIUsageError('Cast speaker key must not be empty.')
      if (binding.locator.provider !== target.provider) {
        throw CLIUsageError(`Voice locator provider ${binding.locator.provider} does not match cast target ${target.provider}.`)
      }
      if (binding.locator.kind === 'reference-asset') assertSha256(binding.locator.protectedAsset.sha256, 'Cast protected asset checksum')
    }
  }
  return cast
}

export const validateGenericTtsSourceIdentity = (
  source: GenericTtsSourceIdentity
): GenericTtsSourceIdentity => {
  if (source.schemaVersion !== 1) throw CLIUsageError('Generic TTS source identity requires schemaVersion 1.')
  assertSha256(source.contentSha256, 'Generic TTS source content hash')
  assertContentIdentity(source as unknown as Record<string, unknown>, 'identityHash', 'Generic TTS source identity')
  if (source.sourceKind !== source.sourceLocator.kind) {
    throw CLIUsageError('Generic TTS source kind does not match its locator kind.')
  }
  if (source.sourceLocator.kind === 'file' && !source.sourceLocator.canonicalPath.trim()) {
    throw CLIUsageError('Generic file source requires its canonical path.')
  }
  if (source.sourceLocator.kind === 'batch-item' && (!source.sourceLocator.canonicalBatchPath.trim() || !Number.isInteger(source.sourceLocator.itemIndex) || source.sourceLocator.itemIndex < 0)) {
    throw CLIUsageError('Generic batch source requires a canonical batch path and non-negative item index.')
  }
  return source
}

export const validateGenericTtsDialoguePlan = (
  plan: GenericTtsDialoguePlan
): GenericTtsDialoguePlan => {
  if (plan.schemaVersion !== 1 || plan.nodes.length === 0 || !plan.normalizationVersion.trim()) {
    throw CLIUsageError('Generic TTS dialogue plan requires schemaVersion 1, a normalization version, and speakable nodes.')
  }
  validateGenericTtsSourceIdentity(plan.sourceIdentity)
  assertContentIdentity(plan as unknown as Record<string, unknown>, 'dialoguePlanId', 'Generic TTS dialogue plan')
  const turns = plan.nodes.flatMap((node) => node.kind === 'turn' ? [node.turn] : node.turns)
  assertUnique(turns.map((turn) => turn.turnId), 'Generic dialogue turn IDs')
  if (turns.some((turn) => !turn.subjectKey.trim() || !turn.originalSpeakerLabel.trim() || !turn.canonicalText.trim())) {
    throw CLIUsageError('Generic dialogue plan cannot contain empty speaker identities or speakable text.')
  }
  return plan
}

const indexLength = (text: string, unit: PreparedProviderText['providerIndexUnit'] | 'unicode-scalar-value'): number => {
  if (unit === 'utf16-code-unit') return text.length
  if (unit === 'utf8-byte') return Buffer.byteLength(text, 'utf8')
  return [...text].length
}

const assertCoordinatesForSpan = (span: PreparedProviderTextSpan): void => {
  const hasCanonical = span.canonicalStart !== undefined || span.canonicalEnd !== undefined
  const hasProvider = span.providerStart !== undefined || span.providerEnd !== undefined
  if (span.kind === 'mapped' && (!hasCanonical || !hasProvider)) throw CLIUsageError('Mapped text span requires both coordinate pairs.')
  if (span.kind === 'canonical-only' && (!hasCanonical || hasProvider)) throw CLIUsageError('Canonical-only span requires only canonical coordinates.')
  if (span.kind === 'provider-only' && (hasCanonical || !hasProvider)) throw CLIUsageError('Provider-only span requires only provider coordinates.')
  for (const [start, end, label] of [
    [span.canonicalStart, span.canonicalEnd, 'canonical'],
    [span.providerStart, span.providerEnd, 'provider']
  ] as const) {
    if ((start === undefined) !== (end === undefined)) throw CLIUsageError(`${label} text span coordinates must be all-or-none.`)
    if (start !== undefined && end !== undefined && (!Number.isInteger(start) || !Number.isInteger(end) || end <= start)) {
      throw CLIUsageError(`${label} text span must be a non-empty zero-based half-open interval.`)
    }
  }
}

const assertGapFreePartition = (
  spans: readonly PreparedProviderTextSpan[],
  side: 'canonical' | 'provider',
  expectedLength: number
): void => {
  const participating = spans.filter((span) => side === 'canonical' ? span.kind !== 'provider-only' : span.kind !== 'canonical-only')
  let cursor = 0
  for (const span of participating) {
    const start = side === 'canonical' ? span.canonicalStart : span.providerStart
    const end = side === 'canonical' ? span.canonicalEnd : span.providerEnd
    if (start !== cursor || end === undefined) throw CLIUsageError(`Prepared text ${side} spans are not a gap-free ordered partition.`)
    cursor = end
  }
  if (cursor !== expectedLength) throw CLIUsageError(`Prepared text ${side} spans do not cover the complete text.`)
}

export const validatePreparedProviderText = (text: PreparedProviderText): PreparedProviderText => {
  if (text.schemaVersion !== 1 || text.canonicalIndexUnit !== 'unicode-scalar-value' || !text.preparationVersion.trim()) {
    throw CLIUsageError('Prepared provider text has an invalid schema or preparation version.')
  }
  if (text.spans.length === 0 && (text.canonicalText.length > 0 || text.providerText.length > 0)) {
    throw CLIUsageError('Non-empty prepared text requires source-map spans.')
  }
  for (const span of text.spans) assertCoordinatesForSpan(span)
  assertGapFreePartition(text.spans, 'canonical', indexLength(text.canonicalText, 'unicode-scalar-value'))
  assertGapFreePartition(text.spans, 'provider', indexLength(text.providerText, text.providerIndexUnit))
  return text
}

const validateTimedToken = (token: TimedToken, durationMs: number | undefined): void => {
  if (!token.turnId.trim() || !token.subjectKey.trim() || !Number.isInteger(token.startMs) || !Number.isInteger(token.endMs)) {
    throw CLIUsageError('Timed token identity and millisecond boundaries are required.')
  }
  if (token.startMs < 0 || token.endMs < token.startMs || (durationMs !== undefined && token.endMs > durationMs)) {
    throw CLIUsageError('Timed token boundaries are outside the selected audio clock.')
  }
}

export const validateNormalizedTiming = <Clock extends TimingClock>(
  timing: NormalizedTiming<Clock>,
  durationMs?: number | undefined
): NormalizedTiming<Clock> => {
  assertUnique(timing.turns.map((turn) => turn.turnId), 'Timing turn IDs')
  if (timing.availability === 'unavailable') {
    if (!timing.reason.trim()) throw CLIUsageError('Unavailable timing requires a reason.')
    return timing
  }
  let previousStart = -1
  for (const turn of timing.turns) {
    if (!Number.isInteger(turn.startMs) || !Number.isInteger(turn.endMs) || turn.startMs < 0 || turn.endMs < turn.startMs) {
      throw CLIUsageError('Timing turn ranges must be valid integer millisecond intervals.')
    }
    if (turn.startMs < previousStart || (durationMs !== undefined && turn.endMs > durationMs)) {
      throw CLIUsageError('Timing turn ranges must be ordered and contained by the audio duration.')
    }
    previousStart = turn.startMs
  }
  for (const token of [...(timing.words ?? []), ...(timing.phonemes ?? []), ...(timing.characters ?? [])]) {
    validateTimedToken(token, durationMs)
    if (!timing.turns.some((turn) => turn.turnId === token.turnId)) throw CLIUsageError('Timed token references an unknown turn.')
  }
  return timing
}

export const providerTimeToMilliseconds = (
  value: number,
  unitMilliseconds: number,
  audioDurationMs: number
): number => {
  if (!Number.isFinite(value) || !Number.isFinite(unitMilliseconds) || value < 0 || unitMilliseconds <= 0) {
    throw CLIUsageError('Provider time conversion requires finite non-negative time and a positive unit.')
  }
  const raw = value * unitMilliseconds
  const rounded = raw >= 0 ? Math.floor(raw + 0.5) : Math.ceil(raw - 0.5)
  return Math.min(audioDurationMs, Math.max(0, rounded))
}

const capabilityFeatureForStrategy = (strategy: ProviderRenderPlan['strategy']): VoiceCapabilityFeature => {
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
  if (plan.renderIdentity !== expectedRenderIdentity || plan.renderIdentity.startsWith('legacy:')) {
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

const assertContiguousSequences = (
  values: readonly number[],
  label: string,
  start = 1
): void => {
  if (values.some((value, index) => !Number.isInteger(value) || value !== index + start)) {
    throw CLIUsageError(`${label} must use contiguous ordered sequences beginning at ${start}.`)
  }
}

const validateAdmissionProofRef = (
  proof: unknown,
  expected: {
    kind: 'acceptance' | 'completion' | 'rejection' | 'ambiguity' | 'not-admitted'
    journalId: string
    invocationId: string
    requestOrdinal: number
    requestFingerprint: string
  }
): void => {
  if (
    !isRecordValue(proof)
    || proof['journalId'] !== expected.journalId
    || proof['invocationId'] !== expected.invocationId
    || proof['requestOrdinal'] !== expected.requestOrdinal
    || proof['requestFingerprint'] !== expected.requestFingerprint
    || proof['proofKind'] !== expected.kind
  ) {
    throw CLIUsageError(`Admission ${expected.kind} proof does not bind the exact journal request.`)
  }
  if (proof['kind'] === 'sanitized-artifact') {
    if (typeof proof['path'] !== 'string' || typeof proof['sha256'] !== 'string') {
      throw CLIUsageError(`Admission ${expected.kind} proof requires a contained artifact and checksum.`)
    }
    assertSafeArtifactRelativePath(proof['path'], 'attempt')
    assertSha256(proof['sha256'], `Admission ${expected.kind} proof checksum`)
    return
  }
  if (proof['kind'] === 'protected-asset') {
    const asset = proof['asset']
    if (
      !isRecordValue(asset)
      || typeof asset['storeId'] !== 'string'
      || asset['storeId'].trim().length === 0
      || typeof asset['assetId'] !== 'string'
      || asset['assetId'].trim().length === 0
      || typeof asset['sha256'] !== 'string'
    ) {
      throw CLIUsageError(`Admission ${expected.kind} protected proof has an invalid asset reference.`)
    }
    assertSha256(asset['sha256'], `Admission ${expected.kind} protected proof checksum`)
    return
  }
  throw CLIUsageError(`Admission ${expected.kind} proof has an invalid storage kind.`)
}

const validateAdmissionTransitions = (
  snapshot: RenderAdmissionJournalSnapshot,
  request: RenderAdmissionJournalSnapshot['requests'][number]
): void => {
  assertContiguousSequences(request.transitions.map((transition) => transition.sequence), 'Admission transition sequence')
  const states = request.transitions.map((transition) => transition.state)
  if (states[0] !== 'prepared') {
    throw CLIUsageError('Admission transitions must begin with prepared.')
  }
  for (const transition of request.transitions) {
    assertIsoDate(transition.at, `Admission ${transition.state} transition`)
    if (transition.state === 'prepared') {
      assertSha256(transition.requestBodyHash, 'Admission prepared request-body hash')
    } else if (transition.state === 'dispatch-started') {
      assertSha256(transition.transportEvidenceHash, 'Admission dispatch transport-evidence hash')
    } else if (transition.state === 'provider-accepted') {
      if (transition.providerRequestId !== undefined && transition.providerRequestId.trim().length === 0) {
        throw CLIUsageError('Admission provider acceptance has an empty provider request ID.')
      }
      validateAdmissionProofRef(transition.evidence, {
        kind: 'acceptance',
        journalId: snapshot.journalId,
        invocationId: snapshot.invocationId,
        requestOrdinal: request.requestOrdinal,
        requestFingerprint: request.requestFingerprint
      })
    } else if (transition.state === 'completed') {
      validateAdmissionProofRef(transition.evidence, {
        kind: 'completion',
        journalId: snapshot.journalId,
        invocationId: snapshot.invocationId,
        requestOrdinal: request.requestOrdinal,
        requestFingerprint: request.requestFingerprint
      })
    } else if (transition.state === 'provider-rejected') {
      validateAdmissionProofRef(transition.evidence, {
        kind: 'rejection',
        journalId: snapshot.journalId,
        invocationId: snapshot.invocationId,
        requestOrdinal: request.requestOrdinal,
        requestFingerprint: request.requestFingerprint
      })
    } else if (transition.state === 'ambiguous' && transition.evidence !== undefined) {
      validateAdmissionProofRef(transition.evidence, {
        kind: 'ambiguity',
        journalId: snapshot.journalId,
        invocationId: snapshot.invocationId,
        requestOrdinal: request.requestOrdinal,
        requestFingerprint: request.requestFingerprint
      })
    } else if (transition.state === 'confirmed-not-admitted') {
      validateAdmissionProofRef(transition.evidence, {
        kind: 'not-admitted',
        journalId: snapshot.journalId,
        invocationId: snapshot.invocationId,
        requestOrdinal: request.requestOrdinal,
        requestFingerprint: request.requestFingerprint
      })
    }
  }

  if (states.length === 1) return
  if (states[1] === 'confirmed-not-admitted') {
    const transition = request.transitions[1]
    if (states.length !== 2 || transition?.state !== 'confirmed-not-admitted' || transition.method !== 'local-before-dispatch') {
      throw CLIUsageError('Only local-before-dispatch confirmation may close a prepared request without dispatch.')
    }
    return
  }
  if (states[1] !== 'dispatch-started') {
    throw CLIUsageError('Admission may advance from prepared only to dispatch-started or local no-admission proof.')
  }
  const afterDispatch = states.slice(2)
  if (afterDispatch.length === 0) return
  if (afterDispatch[0] === 'provider-accepted') {
    if (afterDispatch.length > 2 || (afterDispatch.length === 2 && afterDispatch[1] !== 'completed')) {
      throw CLIUsageError('Provider acceptance may advance only to completion.')
    }
    return
  }
  if (afterDispatch.length !== 1) {
    throw CLIUsageError('A dispatched request may have only one terminal rejection, ambiguity, or no-admission result.')
  }
  if (afterDispatch[0] === 'provider-rejected' || afterDispatch[0] === 'ambiguous') return
  const transition = request.transitions[2]
  if (
    afterDispatch[0] === 'confirmed-not-admitted'
    && transition?.state === 'confirmed-not-admitted'
    && transition.method !== 'local-before-dispatch'
  ) return
  throw CLIUsageError('Admission request contains an invalid post-dispatch transition.')
}

export const validateRenderAdmissionJournalSnapshot = (
  snapshot: RenderAdmissionJournalSnapshot,
  previous?: RenderAdmissionJournalSnapshot | undefined
): RenderAdmissionJournalSnapshot => {
  if (snapshot.schemaVersion !== 1 || snapshot.plannedRequestCount < 0 || !Number.isInteger(snapshot.plannedRequestCount)) {
    throw CLIUsageError('Render admission journal has an invalid schema or planned request count.')
  }
  const expectedJournalId = hashCanonicalTtsValue({
    renderPlanId: snapshot.renderPlanId,
    renderIdentity: snapshot.renderIdentity,
    attempt: snapshot.attempt,
    invocationId: snapshot.invocationId
  })
  if (snapshot.journalId !== expectedJournalId) {
    throw CLIUsageError('Render admission journal ID does not bind its exact render, attempt, and invocation.')
  }
  assertContentIdentity(snapshot as unknown as Record<string, unknown>, 'snapshotId', 'Render admission journal snapshot')
  assertUnique(snapshot.plannedBatchIds, 'Admission journal planned batch IDs')
  const plannedSlots = snapshot.plannedGenerationSlots.map((slot) => `${slot.batchId}\0${slot.generationSlotId}`)
  assertUnique(plannedSlots, 'Admission journal planned generation slots')
  const expectedBatchIds = snapshot.plannedGenerationSlots.reduce<string[]>((batchIds, slot) => {
    if (!batchIds.includes(slot.batchId)) batchIds.push(slot.batchId)
    return batchIds
  }, [])
  if (canonicalTtsJsonForValidation(snapshot.plannedBatchIds) !== canonicalTtsJsonForValidation(expectedBatchIds)) {
    throw CLIUsageError('Admission planned batch IDs must exactly match first occurrence order in the planned generation slots.')
  }
  if (snapshot.plannedRequestCount !== snapshot.plannedGenerationSlots.length) {
    throw CLIUsageError('Admission planning requires exactly one deliberate request budget per generation slot.')
  }
  assertContiguousSequences(snapshot.requests.map((request) => request.requestOrdinal), 'Admission request ordinals')
  const deliberateRequests = snapshot.requests.filter((request) => request.retryOfRequestOrdinal === undefined)
  const deliberateSlots = deliberateRequests.map((request) => `${request.batchId}\0${request.generationSlotId}`)
  assertUnique(deliberateSlots, 'Admission deliberate request generation slots')
  if (deliberateRequests.length > snapshot.plannedRequestCount) {
    throw CLIUsageError('Admission journal contains more deliberate requests than the priced generation-slot plan.')
  }
  for (const request of snapshot.requests) {
    if (!plannedSlots.includes(`${request.batchId}\0${request.generationSlotId}`)) {
      throw CLIUsageError('Admission request references an unplanned generation slot.')
    }
    if (
      !request.batchInvocationPlanId.trim()
      || !request.batchInvocationPlanRef.trim()
      || !SHA256.test(request.batchInvocationPlanSha256)
      || !SHA256.test(request.requestFingerprint)
    ) {
      throw CLIUsageError('Admission request requires a complete invocation-plan reference and request fingerprint.')
    }
    assertSafeArtifactRelativePath(request.batchInvocationPlanRef, 'attempt')
    validateAdmissionTransitions(snapshot, request)
    if (request.retryOfRequestOrdinal !== undefined) {
      const retried = snapshot.requests.find((candidate) => candidate.requestOrdinal === request.retryOfRequestOrdinal)
      if (
        request.retryOfRequestOrdinal >= request.requestOrdinal
        || !retried
        || request.batchId !== retried.batchId
        || request.generationSlotId !== retried.generationSlotId
        || request.batchInvocationPlanId !== retried.batchInvocationPlanId
        || request.batchInvocationPlanRef !== retried.batchInvocationPlanRef
        || request.batchInvocationPlanSha256 !== retried.batchInvocationPlanSha256
        || request.requestFingerprint !== retried.requestFingerprint
      ) {
        throw CLIUsageError('Admission retry must link an earlier request with the identical slot, invocation plan, and fingerprint.')
      }
    }
  }
  const batchResultIds = snapshot.recordedBatchResults.map((result) => result.batchResultId)
  assertUnique(batchResultIds, 'Recorded admission batch result IDs')
  for (const result of snapshot.recordedBatchResults) {
    if (!plannedSlots.includes(`${result.batchId}\0${result.generationSlotId}`)) {
      throw CLIUsageError('Recorded batch result references an unplanned generation slot.')
    }
    const retainedFromPrevious = previous?.recordedBatchResults.some((oldResult) =>
      oldResult.batchResultId === result.batchResultId
      && oldResult.admissionBasisSnapshotId === result.admissionBasisSnapshotId
    ) ?? false
    if (
      previous
      && !retainedFromPrevious
      && result.admissionBasisSnapshotId !== snapshot.snapshotId
      && result.admissionBasisSnapshotId !== snapshot.previousSnapshotId
    ) {
      throw CLIUsageError('Recorded batch result has no exact admission-basis snapshot in this journal chain.')
    }
  }
  if (snapshot.recordedResult && snapshot.recordedBatchResults.length === 0 && snapshot.requests.length > 0) {
    throw CLIUsageError('Aggregate provider result cannot omit batch results after provider requests were prepared.')
  }
  if (previous) {
    if (
      snapshot.journalId !== previous.journalId
      || snapshot.previousSnapshotId !== previous.snapshotId
      || snapshot.renderPlanId !== previous.renderPlanId
      || snapshot.renderIdentity !== previous.renderIdentity
      || snapshot.invocationId !== previous.invocationId
      || snapshot.attempt !== previous.attempt
    ) {
      throw CLIUsageError('Admission journal snapshot does not extend the exact prior attempt snapshot.')
    }
    if (previous.requests.length > snapshot.requests.length) {
      throw CLIUsageError('Admission journal snapshot cannot remove request records.')
    }
    for (const [index, oldRequest] of previous.requests.entries()) {
      const nextRequest = snapshot.requests[index]
      if (!nextRequest) {
        throw CLIUsageError('Admission journal request prefix is append-only.')
      }
      const { transitions: oldTransitionsRaw, ...oldHeader } = oldRequest
      const { transitions: nextTransitionsRaw, ...nextHeader } = nextRequest
      if (canonicalTtsJsonForValidation(oldHeader) !== canonicalTtsJsonForValidation(nextHeader)) {
        throw CLIUsageError('Admission journal request identity is immutable across snapshots.')
      }
      const oldTransitions = oldTransitionsRaw.map((transition) => canonicalTtsJsonForValidation(transition))
      const nextTransitions = nextTransitionsRaw.map((transition) => canonicalTtsJsonForValidation(transition))
      if (oldTransitions.some((transition, transitionIndex) => transition !== nextTransitions[transitionIndex])) {
        throw CLIUsageError('Admission transitions are append-only across journal snapshots.')
      }
    }
    const oldBatchResults = previous.recordedBatchResults.map((result) => canonicalTtsJsonForValidation(result))
    const nextBatchResults = snapshot.recordedBatchResults.map((result) => canonicalTtsJsonForValidation(result))
    if (oldBatchResults.some((result, index) => result !== nextBatchResults[index])) {
      throw CLIUsageError('Admission batch-result promotion is append-only across snapshots.')
    }
    if (
      previous.recordedResult !== undefined
      && canonicalTtsJsonForValidation(previous.recordedResult) !== canonicalTtsJsonForValidation(snapshot.recordedResult)
    ) {
      throw CLIUsageError('Admission aggregate-result promotion is immutable once recorded.')
    }
  }
  return snapshot
}

const canonicalTtsJsonForValidation = (value: unknown): string =>
  canonicalTtsJson(value)

export const validateProviderBatchResult = (
  result: ProviderBatchResult
): ProviderBatchResult => {
  if (result.schemaVersion !== 1) throw CLIUsageError('Provider batch result requires schemaVersion 1.')
  assertContentIdentity(result as unknown as Record<string, unknown>, 'batchResultId', 'Provider batch result')
  assertUnique(result.requestedTurnIds, 'Provider batch requested turn IDs')
  validatePlannedAndObservedCost(result.cost, 'Provider batch result')
  assertUnique(result.outputs.map((output) => output.outputId), 'Provider batch output IDs')
  assertExactStringSet(
    result.turnOutcomes.map((outcome) => outcome.turnId),
    result.requestedTurnIds,
    'Provider batch turn outcomes'
  )
  const outputIds = new Set(result.outputs.map((output) => output.outputId))
  for (const outcome of result.turnOutcomes) {
    if (outcome.outputIds.some((outputId) => !outputIds.has(outputId))) {
      throw CLIUsageError('Provider batch turn outcome references an unknown output.')
    }
    if (outcome.status === 'succeeded' && outcome.outputIds.length === 0) {
      throw CLIUsageError('Succeeded provider batch turn requires at least one linked output.')
    }
    if (outcome.status !== 'succeeded' && outcome.outputIds.length > 0) {
      throw CLIUsageError('Non-succeeded provider batch turn cannot claim a completed output.')
    }
  }
  if (result.status === 'succeeded') {
    if (
      result.outputs.length === 0
      || result.turnOutcomes.length !== result.requestedTurnIds.length
      || result.turnOutcomes.some((outcome) => outcome.status !== 'succeeded')
    ) {
      throw CLIUsageError('Succeeded provider batch requires output and succeeded outcomes for every turn.')
    }
  }
  if (result.provenance === 'cache-materialization') {
    if (result.observedRequests.length !== 0 || result.retryAttempts.length !== 0 || result.createdResources.length !== 0) {
      throw CLIUsageError('Cache-materialized batch result cannot claim provider dispatch, retry, or created resources.')
    }
  } else if (result.status === 'succeeded' && result.observedRequests.length === 0) {
    throw CLIUsageError('Provider-dispatch success requires at least one serializer-observed request.')
  }
  const observedRequestKeys = result.observedRequests.map((request) => `${request.invocationId}\0${request.requestOrdinal}`)
  assertUnique(observedRequestKeys, 'Provider batch observed request identities')
  for (const request of result.observedRequests) {
    validateObservedProviderRequest(request)
    if (
      request.batchId !== result.batchId
      || request.generationSlotId !== result.generationSlotId
      || (result.provenance === 'provider-dispatch' && (
        request.invocationId !== result.invocationId
        || request.batchInvocationPlanId !== result.batchInvocationPlan.batchInvocationPlanId
      ))
      || request.turns.some((turn) => !result.requestedTurnIds.includes(turn.turnId))
    ) {
      throw CLIUsageError('Observed provider request does not belong to its exact batch invocation and requested turn set.')
    }
    assertUnique(request.turns.map((turn) => turn.turnId), 'Observed provider request turns')
  }
  if (result.provenance === 'provider-dispatch' && result.status === 'succeeded') {
    const observedTurnIds = new Set(result.observedRequests.flatMap((request) => request.turns.map((turn) => turn.turnId)))
    if (
      observedTurnIds.size !== result.requestedTurnIds.length
      || result.requestedTurnIds.some((turnId) => !observedTurnIds.has(turnId))
    ) {
      throw CLIUsageError('Succeeded provider dispatch must serializer-observe every requested turn.')
    }
  }
  for (const retry of result.retryAttempts) {
    if (
      retry.invocationId !== (result.provenance === 'provider-dispatch' ? result.invocationId : '')
      || retry.retryOfRequestOrdinal >= retry.requestOrdinal
      || !result.observedRequests.some((request) => request.requestOrdinal === retry.requestOrdinal)
      || !result.observedRequests.some((request) => request.requestOrdinal === retry.retryOfRequestOrdinal)
    ) {
      throw CLIUsageError('Provider retry record does not link two ordered observed requests from the same invocation.')
    }
  }
  if (result.generatedBatch) {
    if (result.generatedBatch.batchId !== result.batchId || result.generatedBatch.generationSlotId !== result.generationSlotId) {
      throw CLIUsageError('Generated batch identity does not match its provider batch result.')
    }
    assertUnique(result.generatedBatch.takes.map((take) => take.takeId), 'Generated take IDs')
    validatePlannedAndObservedCost(result.generatedBatch.batchCost, 'Generated provider batch')
    for (const take of result.generatedBatch.takes) {
      if (take.generationSlotId !== result.generationSlotId || (take.audio.outputId && !outputIds.has(take.audio.outputId))) {
        throw CLIUsageError('Generated take does not bind the result generation slot and one of its outputs.')
      }
    }
  }
  return result
}

export const validateProviderRenderResult = (
  result: ProviderRenderResult
): ProviderRenderResult => {
  if (result.schemaVersion !== 1) throw CLIUsageError('Provider render result requires schemaVersion 1.')
  assertContentIdentity(result as unknown as Record<string, unknown>, 'resultIdentity', 'Provider render result')
  assertUnique(result.requestedTurnIds, 'Provider render requested turn IDs')
  validatePlannedAndObservedCost(result.cost.currentComposition, 'Provider render current composition')
  validatePlannedAndObservedCost(result.cost.closingAttempt, 'Provider render closing attempt')
  validatePlannedAndObservedCost(result.cost.cumulativeRenderHistory, 'Provider render cumulative history')
  assertUnique(result.batchResults.map((entry) => entry.batchResultId), 'Provider render batch result IDs')
  assertUnique(result.outputs.map((entry) => `${entry.batchResultId}\0${entry.outputId}`), 'Provider render output IDs')
  assertUnique(result.outputs.map((entry) => entry.outputId), 'Provider render globally addressable output IDs')
  assertExactStringSet(
    result.turnOutcomes.map((outcome) => outcome.turnId),
    result.requestedTurnIds,
    'Provider render turn outcomes'
  )
  if (result.status === 'succeeded') {
    if (result.outputs.length === 0 || result.turnOutcomes.length !== result.requestedTurnIds.length || result.turnOutcomes.some((outcome) => outcome.status !== 'succeeded')) {
      throw CLIUsageError('Succeeded provider render requires output and succeeded outcomes for every requested turn.')
    }
  }
  const observedKeys = result.observedRequests.map((request) => `${request.invocationId}\0${request.requestOrdinal}`)
  assertUnique(observedKeys, 'Provider render observed request identities')
  const batchIds = new Set(result.batchResults.map((entry) => entry.batchId))
  const generationSlotIds = new Set(result.batchResults.map((entry) => entry.generationSlotId))
  const aggregateOutputIds = new Set(result.outputs.map((output) => output.outputId))
  const batchResultIds = new Set(result.batchResults.map((entry) => entry.batchResultId))
  if (result.outputs.some((output) => !batchResultIds.has(output.batchResultId))) {
    throw CLIUsageError('Provider render output references an unknown batch result.')
  }
  for (const request of result.observedRequests) {
    validateObservedProviderRequest(request)
    if (
      !batchIds.has(request.batchId)
      || !generationSlotIds.has(request.generationSlotId)
      || request.turns.some((turn) => !result.requestedTurnIds.includes(turn.turnId))
    ) {
      throw CLIUsageError('Observed provider request references an unknown batch, slot, or turn in the aggregate result.')
    }
  }
  for (const outcome of result.turnOutcomes) {
    for (const request of outcome.observedRequests) {
      if (!observedKeys.includes(`${request.invocationId}\0${request.requestOrdinal}`)) {
        throw CLIUsageError('Turn outcome references an unknown observed provider request.')
      }
    }
    if (
      outcome.batchIds.some((batchId) => !batchIds.has(batchId))
      || outcome.generationSlotIds.some((slotId) => !generationSlotIds.has(slotId))
      || outcome.outputIds.some((outputId) => !aggregateOutputIds.has(outputId))
    ) {
      throw CLIUsageError('Turn outcome references an unknown batch, generation slot, or output.')
    }
    if (
      outcome.status === 'succeeded'
      && (
        outcome.outputIds.length === 0
        || (result.closedBy.kind === 'provider-attempt' && outcome.observedRequests.length === 0)
      )
    ) {
      throw CLIUsageError('Succeeded provider render turn requires output linkage and provider-attempt observation when dispatched.')
    }
  }
  for (const batch of result.generatedBatches) {
    if (!batchIds.has(batch.batchId) || !generationSlotIds.has(batch.generationSlotId)) {
      throw CLIUsageError('Generated provider batch does not belong to the aggregate result plan.')
    }
  }
  return result
}

export const validateCacheMaterializationPlan = (
  plan: CacheMaterializationPlan
): CacheMaterializationPlan => {
  if (plan.schemaVersion !== 1) throw CLIUsageError('Cache materialization plan requires schemaVersion 1.')
  assertContentIdentity(plan as unknown as Record<string, unknown>, 'cacheMaterializationPlanId', 'Cache materialization plan')
  if (!plan.portableSemanticInputHash.trim() || !plan.currentExecutionInputHash.trim()) {
    throw CLIUsageError('Cache materialization requires portable and current execution input identities.')
  }
  if (plan.resolvedContinuation.kind === 'none' && plan.continuationFingerprint.kind !== 'none') {
    throw CLIUsageError('Cache continuation fingerprint must be none when no continuation is resolved.')
  }
  if (plan.resolvedContinuation.kind === 'checkpoint' && plan.continuationFingerprint.kind !== 'checkpoint') {
    throw CLIUsageError('Cache checkpoint materialization requires a checkpoint semantic fingerprint.')
  }
  return plan
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
