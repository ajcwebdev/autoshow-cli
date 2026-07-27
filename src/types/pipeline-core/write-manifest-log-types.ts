import type { HostedOcrSchedulerSection, OcrCostCalculationSection, PromptUsageSection, SummarySection, WriteStepKind } from '~/types'

export type ManifestLogCostEntryLike = {
  step: WriteStepKind
  provider: string
  model: string
  cost: number
  costSource?: string
  inputMetric?: string
  inputValue?: number
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
