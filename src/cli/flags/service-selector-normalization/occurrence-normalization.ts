import type { CliFlagOccurrence, SelectorNormalizationResult } from '~/types'

const appendFlagValue = (
  flags: Record<string, unknown>,
  flagName: string,
  value: string | boolean
): void => {
  const current = flags[flagName]
  if (Array.isArray(current)) {
    current.push(value)
    return
  }
  if (current !== undefined) {
    flags[flagName] = [current, value]
    return
  }
  flags[flagName] = value
}

export type FlagOccurrenceReplacement = {
  occurrence: CliFlagOccurrence
  update: 'append' | 'set'
}

export const replaceFlagOccurrence = (
  occurrence: CliFlagOccurrence,
  name: string,
  value: string | boolean = occurrence.value,
  update: FlagOccurrenceReplacement['update'] = 'set'
): FlagOccurrenceReplacement => ({
  occurrence: {
    ...occurrence,
    name,
    value,
    known: true
  },
  update
})

export const applyFlagOccurrenceNormalization = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[],
  rewrite: (occurrence: CliFlagOccurrence) => FlagOccurrenceReplacement[] | undefined
): SelectorNormalizationResult => {
  const rewritten = flagOccurrences.map((occurrence) => ({
    source: occurrence,
    replacements: rewrite(occurrence)
  }))
  const changedSourceNames = new Set(
    rewritten
      .filter((entry) => entry.replacements !== undefined)
      .map((entry) => entry.source.name)
  )
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)

  for (const sourceName of changedSourceNames) {
    delete normalizedFlags[sourceName]
    normalizedExplicitFlags.delete(sourceName)
  }

  for (const entry of rewritten) {
    if (entry.replacements === undefined) {
      continue
    }
    for (const replacement of entry.replacements) {
      const { name, value } = replacement.occurrence
      normalizedExplicitFlags.add(name)
      if (replacement.update === 'append') {
        appendFlagValue(normalizedFlags, name, value)
      } else {
        normalizedFlags[name] = value
      }
    }
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags,
    flagOccurrences: rewritten.flatMap((entry) =>
      entry.replacements?.map((replacement) => replacement.occurrence) ?? [entry.source]
    )
  }
}
