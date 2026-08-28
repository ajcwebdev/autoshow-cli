import type { CliFlagOccurrence } from '~/types'

export type SelectorNormalizationResult = {
  flags: Record<string, unknown>
  explicitFlags: Set<string>
  flagOccurrences: CliFlagOccurrence[]
}

export type ExtractSelectorInputRoutes = {
  media: boolean
  document: boolean
  article?: boolean | undefined
}

export type FlagOccurrenceReplacement = {
  occurrence: CliFlagOccurrence
  update: 'append' | 'set'
}
