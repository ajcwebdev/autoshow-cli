import type { AccountCapabilityObservation, AnyCapabilityRecord, GenericTtsDialoguePlan, GenericTtsSourceIdentity, PreparedProviderText, PreparedProviderTextSpan, ProviderVoiceRef } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { assertContentIdentity } from './contract-identity'
import { assertIsoDate, assertSha256, assertUnique } from './contract-validation-primitives'

export const validateProviderVoiceRef = (voice: ProviderVoiceRef): ProviderVoiceRef => {
  if (voice.kind === 'remote-resource') {
    if (!voice.resourceId.trim()) throw UsageError('Remote voice resource ID must not be empty.')
    if (voice.namespace === 'account' && !voice.accountScopeHash) {
      throw UsageError('Account-namespaced voice requires accountScopeHash.')
    }
    if (voice.namespace === 'provider' && voice.accountScopeHash !== undefined) {
      throw UsageError('Provider-namespaced voice forbids accountScopeHash.')
    }
    if (voice.derivedFrom) {
      if (!voice.derivedFrom.sourceRef.trim() || !voice.derivedFrom.localAttemptId.trim()) throw UsageError('Remote voice lineage requires source and local-attempt identity.')
      assertSha256(voice.derivedFrom.sourceIdentityHash, 'Remote voice lineage source identity hash')
      if (voice.derivedFrom.eligibilitySnapshotHash !== undefined) assertSha256(voice.derivedFrom.eligibilitySnapshotHash, 'Remote voice lineage eligibility snapshot hash')
      if (voice.derivedFrom.operation === 'remixed-from' && !voice.derivedFrom.eligibilitySnapshotHash) throw UsageError('Remixed voice lineage requires its eligibility snapshot hash.')
    }
  } else if (voice.kind === 'reference-asset') {
    assertSha256(voice.protectedAsset.sha256, 'Protected voice asset checksum')
    if (!voice.authorizationRef.trim()) throw UsageError('Reference voice requires an authorization reference.')
  } else if (voice.kind === 'local-model-voice') {
    if (!voice.model.trim() || !voice.voiceLocator.trim()) throw UsageError('Local voice requires model and locator values.')
  }
  return voice
}
export const validateCapabilityRecord = (record: AnyCapabilityRecord): AnyCapabilityRecord => {
  if (record.channel === 'unsupported') {
    if (record.maturity !== 'not-applicable' || record.adapterSupport !== 'unsupported') {
      throw UsageError('Unsupported capability channel requires not-applicable maturity and unsupported adapter support.')
    }
  } else if (record.maturity === 'not-applicable') {
    throw UsageError('A supported capability channel cannot have not-applicable maturity.')
  }
  if (record.adapterSupport === 'implemented' && record.channel === 'ui-only') {
    throw UsageError('A UI-only capability cannot be implemented as an API adapter facet.')
  }
  assertIsoDate(record.documentationEvidence.checkedAt, 'Capability evidence checkedAt')
  if (record.documentationEvidence.sourceRefs.length === 0 || record.documentationEvidence.sourceRefs.some((ref) => !ref.trim())) {
    throw UsageError('Capability evidence requires non-empty source references.')
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
      throw UsageError('Account capability observation expiry must follow checkedAt.')
    }
  }
  if (observation.state === 'available' && observation.unmetRequirements.length > 0) {
    throw UsageError('Available account capability cannot have unmet requirements.')
  }
  if (observation.state !== 'available' && observation.satisfiedRequirements.length > 0 && observation.unmetRequirements.length === 0) {
    throw UsageError('Non-available account capability must retain an unmet requirement or an empty requirement set.')
  }
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (expectedValue !== undefined && observation[key as keyof AccountCapabilityObservation] !== expectedValue) {
      throw UsageError(`Account capability observation has a mismatched ${key}.`)
    }
  }
  return observation
}

export const validateGenericTtsSourceIdentity = (
  source: GenericTtsSourceIdentity
): GenericTtsSourceIdentity => {
  if (source.schemaVersion !== 1) throw UsageError('Generic TTS source identity requires schemaVersion 1.')
  assertSha256(source.contentSha256, 'Generic TTS source content hash')
  assertContentIdentity(source as unknown as Record<string, unknown>, 'identityHash', 'Generic TTS source identity')
  if (source.sourceKind !== source.sourceLocator.kind) {
    throw UsageError('Generic TTS source kind does not match its locator kind.')
  }
  if (source.sourceLocator.kind === 'file' && !source.sourceLocator.canonicalPath.trim()) {
    throw UsageError('Generic file source requires its canonical path.')
  }
  if (source.sourceLocator.kind === 'batch-item' && (!source.sourceLocator.canonicalBatchPath.trim() || !Number.isInteger(source.sourceLocator.itemIndex) || source.sourceLocator.itemIndex < 0)) {
    throw UsageError('Generic batch source requires a canonical batch path and non-negative item index.')
  }
  return source
}

export const validateGenericTtsDialoguePlan = (
  plan: GenericTtsDialoguePlan
): GenericTtsDialoguePlan => {
  if (plan.schemaVersion !== 1 || plan.nodes.length === 0 || !plan.normalizationVersion.trim()) {
    throw UsageError('Generic TTS dialogue plan requires schemaVersion 1, a normalization version, and speakable nodes.')
  }
  validateGenericTtsSourceIdentity(plan.sourceIdentity)
  assertContentIdentity(plan as unknown as Record<string, unknown>, 'dialoguePlanId', 'Generic TTS dialogue plan')
  const turns = plan.nodes.flatMap((node) => node.kind === 'turn' ? [node.turn] : node.turns)
  assertUnique(turns.map((turn) => turn.turnId), 'Generic dialogue turn IDs')
  if (turns.some((turn) => !turn.subjectKey.trim() || !turn.originalSpeakerLabel.trim() || !turn.canonicalText.trim())) {
    throw UsageError('Generic dialogue plan cannot contain empty speaker identities or speakable text.')
  }
  return plan
}

export const indexLength = (text: string, unit: PreparedProviderText['providerIndexUnit'] | 'unicode-scalar-value'): number => {
  if (unit === 'utf16-code-unit') return text.length
  if (unit === 'utf8-byte') return Buffer.byteLength(text, 'utf8')
  return [...text].length
}

export const assertCoordinatesForSpan = (span: PreparedProviderTextSpan): void => {
  const hasCanonical = span.canonicalStart !== undefined || span.canonicalEnd !== undefined
  const hasProvider = span.providerStart !== undefined || span.providerEnd !== undefined
  if (span.kind === 'mapped' && (!hasCanonical || !hasProvider)) throw UsageError('Mapped text span requires both coordinate pairs.')
  if (span.kind === 'canonical-only' && (!hasCanonical || hasProvider)) throw UsageError('Canonical-only span requires only canonical coordinates.')
  if (span.kind === 'provider-only' && (hasCanonical || !hasProvider)) throw UsageError('Provider-only span requires only provider coordinates.')
  for (const [start, end, label] of [
    [span.canonicalStart, span.canonicalEnd, 'canonical'],
    [span.providerStart, span.providerEnd, 'provider']
  ] as const) {
    if ((start === undefined) !== (end === undefined)) throw UsageError(`${label} text span coordinates must be all-or-none.`)
    if (start !== undefined && end !== undefined && (!Number.isInteger(start) || !Number.isInteger(end) || end <= start)) {
      throw UsageError(`${label} text span must be a non-empty zero-based half-open interval.`)
    }
  }
}

export const assertGapFreePartition = (
  spans: readonly PreparedProviderTextSpan[],
  side: 'canonical' | 'provider',
  expectedLength: number
): void => {
  const participating = spans.filter((span) => side === 'canonical' ? span.kind !== 'provider-only' : span.kind !== 'canonical-only')
  let cursor = 0
  for (const span of participating) {
    const start = side === 'canonical' ? span.canonicalStart : span.providerStart
    const end = side === 'canonical' ? span.canonicalEnd : span.providerEnd
    if (start !== cursor || end === undefined) throw UsageError(`Prepared text ${side} spans are not a gap-free ordered partition.`)
    cursor = end
  }
  if (cursor !== expectedLength) throw UsageError(`Prepared text ${side} spans do not cover the complete text.`)
}

export const validatePreparedProviderText = (text: PreparedProviderText): PreparedProviderText => {
  if (text.schemaVersion !== 1 || text.canonicalIndexUnit !== 'unicode-scalar-value' || !text.preparationVersion.trim()) {
    throw UsageError('Prepared provider text has an invalid schema or preparation version.')
  }
  if (text.spans.length === 0 && (text.canonicalText.length > 0 || text.providerText.length > 0)) {
    throw UsageError('Non-empty prepared text requires source-map spans.')
  }
  for (const span of text.spans) assertCoordinatesForSpan(span)
  assertGapFreePartition(text.spans, 'canonical', indexLength(text.canonicalText, 'unicode-scalar-value'))
  assertGapFreePartition(text.spans, 'provider', indexLength(text.providerText, text.providerIndexUnit))
  return text
}
