import type { AggregatedPriceEstimate, CliFlagOccurrence, ComicRecoveryStagePlan, ResumeResult } from '~/types'

export type ResumeSelectorNormalizationResult = {
  flags: Record<string, unknown>
  explicitFlags: Set<string>
  flagOccurrences: CliFlagOccurrence[]
}

export type ResumeDispatchOutcome = {
  comicPlan?: { directory: string; ready: boolean; stages: ComicRecoveryStagePlan[] } | undefined
  estimate?: AggregatedPriceEstimate | undefined
  result?: ResumeResult | undefined
}
