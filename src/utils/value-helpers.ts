/**
 * Small value-level helpers shared across the pipeline. This module deliberately imports
 * nothing from the project so any module can depend on it without risking an import cycle.
 */

/** Narrows to a plain object. Arrays are excluded, so `'field' in value` stays meaningful. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Narrows to any non-null object, arrays included. Distinct from `isRecord`, which several
 * modules had independently reimplemented under the same name with the opposite array rule;
 * the two behaviors now have separate names so a caller has to pick one deliberately.
 */
export const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Coerces a concurrency/limit input to a whole number of at least 1, treating NaN and Infinity as 1. */
export const normalizePositiveInt = (value: number): number =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1

/** Rounds a reported metric to thousandths, normalizing `-0` so serialized values compare equal. */
export const roundMetric = (value: number): number => {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}

export const formatQuotedChoiceList = (choices: readonly string[]): string => {
  const quotedChoices = choices.map((choice) => `"${choice}"`)
  if (quotedChoices.length <= 2) {
    return quotedChoices.join(' or ')
  }
  return `${quotedChoices.slice(0, -1).join(', ')}, or ${quotedChoices[quotedChoices.length - 1]}`
}

/** Normalizes an arbitrary string into a bounded, filesystem- and key-safe slug. */
export const safeKeyPart = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized.slice(0, 48) || 'none'
}

export const sha256Bytes = (value: string | Uint8Array): string =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex')
