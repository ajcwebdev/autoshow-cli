import { isAbsolute, posix } from 'node:path'
import type { ArtifactPathScope, CanonicalValue, ProviderRenderStrategy } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { safeKeyPart } from '~/utils/value-helpers'
import { sha256Bytes } from '~/utils/value-helpers'

export { sha256Bytes }
export { canonicalTargetKey } from '~/utils/canonical-target-key'

const canonicalizeValue = (value: unknown, path: string): CanonicalValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw UsageError(`Cannot hash non-finite number at ${path}.`)
    }
    return Object.is(value, -0) ? 0 : value
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => canonicalizeValue(entry, `${path}[${index}]`))
  }
  if (typeof value !== 'object' || value === undefined) {
    throw UsageError(`Cannot canonically serialize ${typeof value} at ${path}.`)
  }

  const record = value as Record<string, unknown>
  const result: Record<string, CanonicalValue> = {}
  for (const key of Object.keys(record).sort()) {
    const entry = record[key]
    if (entry === undefined) {
      throw UsageError(`Cannot canonically serialize undefined at ${path}.${key}. Omit optional fields instead.`)
    }
    result[key] = canonicalizeValue(entry, `${path}.${key}`)
  }
  return result
}

export const canonicalTtsJson = (value: unknown): string =>
  JSON.stringify(canonicalizeValue(value, '$'))

export const hashCanonicalTtsValue = (value: unknown): string =>
  sha256Bytes(canonicalTtsJson(value))

export const hashCanonicalRecordWithout = <T extends Record<string, unknown>>(
  value: T,
  omittedKeys: readonly string[]
): string => {
  const copy: Record<string, unknown> = { ...value }
  for (const key of omittedKeys) delete copy[key]
  return hashCanonicalTtsValue(copy)
}

export const assertContentIdentity = <T extends Record<string, unknown>>(
  value: T,
  identityField: keyof T & string,
  label: string,
  additionalOmittedFields: readonly string[] = []
): void => {
  const actual = value[identityField]
  const expected = hashCanonicalRecordWithout(value, [identityField, ...additionalOmittedFields])
  if (typeof actual !== 'string' || actual !== expected) {
    throw UsageError(`${label} has an invalid ${identityField}; expected ${expected}.`)
  }
}

export const computeVoiceContextKey = (
  context:
    | { kind: 'approved-snapshot', snapshotId: string }
    | { kind: 'transient', turns: Array<{ turnId: string, bindingIdentityHash: string }> }
): string => {
  if (context.kind === 'approved-snapshot') {
    if (!context.snapshotId.trim()) throw UsageError('Approved voice context requires a snapshot ID.')
    return `approved:${context.snapshotId}`
  }
  const turns = context.turns.slice().sort((left, right) =>
    left.turnId.localeCompare(right.turnId) || left.bindingIdentityHash.localeCompare(right.bindingIdentityHash)
  )
  if (new Set(turns.map((turn) => turn.turnId)).size !== turns.length) {
    throw UsageError('Transient voice context contains duplicate turn IDs.')
  }
  return hashCanonicalTtsValue({ schemaVersion: 1, kind: 'transient', turns })
}

export const computeRenderIdentity = (input: {
  renderPlanId: string
  targetKey: string
  strategy: ProviderRenderStrategy
  voiceContextKey: string
  synthesisSettingsHash: string
  outputProfileHash: string
}): string => hashCanonicalTtsValue(input)

export const computePaidSpeechSlotHash = (input: {
  dialoguePlanId: string
  turnIds: readonly string[]
  providerText: string
  serializedVoiceHash: string
  requestControlsHash: string
  outputFormat: unknown
  endpointKind: string
  serializerVersion: string
}): string => hashCanonicalTtsValue({
  schemaVersion: 1,
  kind: 'paid-speech-slot',
  dialoguePlanId: input.dialoguePlanId,
  turnIds: [...input.turnIds],
  providerText: input.providerText,
  serializedVoiceHash: input.serializedVoiceHash,
  requestControlsHash: input.requestControlsHash,
  outputFormat: input.outputFormat,
  endpointKind: input.endpointKind,
  serializerVersion: input.serializerVersion,
})

const ENCODED_PATH_SEPARATOR_OR_DOT = /%(?:2e|2f|5c)/i

export const assertSafeArtifactRelativePath = (
  value: string,
  scope: ArtifactPathScope,
  containingIdentity?: string | undefined
): string => {
  if (
    value.length === 0
    || value.trim() !== value
    || value.includes('\\')
    || value.includes('\0')
    || isAbsolute(value)
    || posix.isAbsolute(value)
    || ENCODED_PATH_SEPARATOR_OR_DOT.test(value)
  ) {
    throw UsageError(`Invalid ${scope} artifact path: ${value}`)
  }
  const segments = value.split('/')
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw UsageError(`Invalid ${scope} artifact path: ${value}`)
  }
  if (containingIdentity && segments.includes(containingIdentity)) {
    throw UsageError(`${scope} artifact path must not contain its parent identity: ${value}`)
  }
  const normalized = posix.normalize(value)
  if (normalized !== value || normalized.startsWith('../')) {
    throw UsageError(`Invalid ${scope} artifact path: ${value}`)
  }
  return value
}

export const encodeArtifactKey = (value: string): string => {
  const prefix = safeKeyPart(value).slice(0, 32)
  return `${prefix}-${sha256Bytes(value).slice(0, 24)}`
}
