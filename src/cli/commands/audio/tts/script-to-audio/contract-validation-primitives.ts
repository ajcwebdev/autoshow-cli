import type { ObservedProviderRequest } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/value-helpers'
import { canonicalTtsJson } from './contract-identity'

export const SHA256 = /^[a-f0-9]{64}$/

export const canonicalTtsJsonForValidation = (value: unknown): string => canonicalTtsJson(value)

export const assertSha256 = (value: string, label: string): void => {
  if (!SHA256.test(value)) throw UsageError(`${label} must be a lowercase SHA-256 digest.`)
}

export const assertIsoDate = (value: string, label: string): void => {
  if (Number.isNaN(Date.parse(value))) throw UsageError(`${label} must be an ISO date-time.`)
}

export const assertUnique = (values: readonly string[], label: string): void => {
  if (new Set(values).size !== values.length) throw UsageError(`${label} contains duplicate values.`)
}

export const assertExactStringSet = (
  actual: readonly string[],
  expected: readonly string[],
  label: string
): void => {
  assertUnique(actual, label)
  assertUnique(expected, `${label} expectation`)
  const expectedValues = new Set(expected)
  if (actual.length !== expected.length || actual.some((value) => !expectedValues.has(value))) {
    throw UsageError(`${label} must exactly cover its requested identities.`)
  }
}

export const validatePlannedCost = (cost: { amounts: Array<{ amount: number, currency: string }> }, label: string): void => {
  if (!Array.isArray(cost.amounts)) throw UsageError(`${label} requires an amount list.`)
  for (const amount of cost.amounts) {
    if (!Number.isFinite(amount.amount) || amount.amount < 0 || !amount.currency.trim()) {
      throw UsageError(`${label} contains an invalid non-negative currency amount.`)
    }
  }
}

export const validateObservedCost = (amounts: Array<{ amount: number, currency: string }>, label: string): void => {
  for (const amount of amounts) {
    if (!Number.isFinite(amount.amount) || amount.amount < 0 || !amount.currency.trim()) {
      throw UsageError(`${label} contains an invalid non-negative currency amount.`)
    }
  }
}

export const validatePlannedAndObservedCost = (
  cost: { planned: { amounts: Array<{ amount: number, currency: string }> }, observed: Array<{ amount: number, currency: string }> },
  label: string
): void => {
  validatePlannedCost(cost.planned, `${label} planned cost`)
  validateObservedCost(cost.observed, `${label} observed cost`)
}

export const validateTypedSettings = (
  settings: { schemaVersion: 1, settingsSchema: string, values: Record<string, unknown> },
  label: string
): void => {
  if (settings.schemaVersion !== 1 || !settings.settingsSchema.trim() || !isRecord(settings.values)) {
    throw UsageError(`${label} requires schemaVersion 1, a settings schema, and values.`)
  }
  for (const value of Object.values(settings.values)) {
    if (
      value !== null
      && typeof value !== 'string'
      && typeof value !== 'number'
      && typeof value !== 'boolean'
      && !(Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
    ) {
      throw UsageError(`${label} contains an unsupported setting value.`)
    }
  }
}

export const validateObservedProviderRequest = (request: ObservedProviderRequest): void => {
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
    throw UsageError('Observed provider request requires complete serializer identity and request hashes.')
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
      throw UsageError('Observed provider request turn has invalid text, voice, control, or delivery evidence.')
    }
  }
  if (request.acceptedAt !== undefined) assertIsoDate(request.acceptedAt, 'Observed provider request acceptance')
}
