import type { ParsedCommandMetric, ParsedJunitCase, ProviderIdentityBase } from '~/types'

export type ReportArgServiceFlag = { service: string, kind: string }

export type MatchProvenance = 'name-file' | 'name-global' | 'line-unique' | 'group-order' | 'heuristic'

export type MetricMatchEntry = { metrics: ParsedCommandMetric[]; matchedBy: MatchProvenance }

export type MetricMatchResult = Map<string, MetricMatchEntry>

export type ReportHistoricalLookup = {
  durationById: Map<string, number>
  processingTimeById: Map<string, number>
}

export type ServiceModelPair = ProviderIdentityBase<string, string | null> & {
  kind: string | null
}

export type MetricContext = {
  metric: ParsedCommandMetric
  kind: string | null
  isPrice: boolean
  pairs: ServiceModelPair[]
}

export type ReportTestContext = {
  testCase: ParsedJunitCase
  kind: string | null
  isPrice: boolean
  serviceHints: Set<string>
  modelHints: Set<string>
}

export type BudgetPreflightSummary = {
  suiteName: string
  budgetHundredthCents: number
  commandsChecked: number
  commandsRunnable: number
  commandsSkipped: number
  commandsFailed: number
  runnableEstimatedCostCents: number
  skipKeys: string[]
  skippedEntries: {
    key: string
    selectedCostCents: number
  }[]
}
