import type { AggregatedPriceEstimate, ResumeResult } from '~/types'

export type ResumeSelectorNormalizationResult = {
  flags: Record<string, unknown>
  explicitFlags: Set<string>
  rawArgs: string[]
}

export type ResumeDispatchOutcome = {
  estimate?: AggregatedPriceEstimate | undefined
  result?: ResumeResult | undefined
}
