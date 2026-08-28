
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const normalizePositiveInt = (value: number): number =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1

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

export const safeKeyPart = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized.slice(0, 48) || 'none'
}

export const sha256Bytes = (value: string | Uint8Array): string =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex')
