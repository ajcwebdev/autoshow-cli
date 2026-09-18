import type { AggregatedPriceEstimate, ComicRecoveryStagePlan, ResumeResult } from '~/types'

export type ResumeSelectorNormalizationResult = import('./service-selector-normalization-types').SelectorNormalizationResult

export type ResumeDispatchOutcome = {
  comicPlan?: { directory: string; ready: boolean; stages: ComicRecoveryStagePlan[] } | undefined
  estimate?: AggregatedPriceEstimate | undefined
  result?: ResumeResult | undefined
}
