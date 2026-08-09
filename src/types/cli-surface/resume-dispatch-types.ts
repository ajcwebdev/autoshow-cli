import type { AggregatedPriceEstimate, CliFlagOccurrence, ResumeResult } from '~/types'

export type ResumeSelectorNormalizationResult = {
  flags: Record<string, unknown>
  explicitFlags: Set<string>
  flagOccurrences: CliFlagOccurrence[]
}

export type ResumeDispatchOutcome = {
  estimate?: AggregatedPriceEstimate | undefined
  result?: ResumeResult | undefined
}
