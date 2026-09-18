export const groupRowsByKey = <T,>(
  rows: readonly T[],
  keyOf: (row: T) => string
): Map<string, T[]> => {
  const indexed = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const existing = indexed.get(key) ?? []
    existing.push(row)
    indexed.set(key, existing)
  }
  return indexed
}
