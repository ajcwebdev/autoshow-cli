import type { CostSource, HostedOcrSchedulerSection, OcrCostCalculationSection, PromptUsageSection, SummarySection, WriteStepKind } from '~/types'

export type ManifestLogCostEntryLike = {
  step: WriteStepKind
  provider: string
  model: string
  cost: number
  costSource?: string
  inputMetric?: string
  inputValue?: number
}

export type ManifestLogActualCostBreakdown = {
  totalCost: number
  steps: Array<Omit<ManifestLogCostEntryLike, 'costSource'> & { costSource?: CostSource }>
}

export type ManifestLogIndexedRow<T> = {
  key: string
  occurrence: number
  value: T
}

export type WriteManifestConsoleSummary = {
  runSummary?: SummarySection
  promptUsage?: PromptUsageSection
  ocrCostCalculation?: OcrCostCalculationSection
  hostedOcrScheduler?: HostedOcrSchedulerSection
}
