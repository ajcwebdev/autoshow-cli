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

// Read back from a persisted manifest rather than produced by the pricing layer:
// costSource is present only when the manifest recorded a known vocabulary value.
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
