import type { CliRawParsed } from '~/types'

const displaySpelling = (raw: string): string => {
  if (!raw.startsWith('--')) return raw
  const inlineValueIndex = raw.indexOf('=')
  return inlineValueIndex === -1 ? raw : raw.slice(0, inlineValueIndex)
}

export const getUnknownFlagSpellings = (rawParsed: CliRawParsed): string[] => {
  const occurrenceSpellings = rawParsed.flagOccurrences
    .filter((occurrence) => !occurrence.known)
    .map((occurrence) => displaySpelling(occurrence.raw))

  const spellings = occurrenceSpellings.length > 0
    ? occurrenceSpellings
    : Object.keys(rawParsed.unknown).map((name) => name.startsWith('-') ? name : `--${name}`)

  return [...new Set(spellings)]
}
