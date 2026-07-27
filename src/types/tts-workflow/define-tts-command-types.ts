import type { ActualCostBreakdown, AggregatedPriceEstimate, EstimatedCostBreakdown, Step4Metadata, StepTimingBreakdown, TtsBatchEstimateSummary } from '~/types'

export type PreparedTtsInput = {
  inputPath: string
  text: string
  ttsCharacterCount: number
  ttsTimingInputText: string
  dialogueRequested: boolean
  dialogueTurnCount?: number | undefined
}


export type PreparedTtsRun = {
  metadata: Step4Metadata[]
  cost: {
    estimated: EstimatedCostBreakdown
    observedEstimate: EstimatedCostBreakdown
    actual: ActualCostBreakdown
  }
  timing: {
    estimated: StepTimingBreakdown
    actual: StepTimingBreakdown
  }
}

export type CompletedTtsBatchItem = {
  index: number
  inputPath: string
  itemStem: string
  metadata: Step4Metadata[]
  characterCount: number
  run: PreparedTtsRun
}

export type TtsBatchEstimateReport = {
  estimates: AggregatedPriceEstimate[]
  totalEstimatedCost: number
  summary: TtsBatchEstimateSummary
}

export type TtsBatchPlanItem = {
  index: number
  prepared: PreparedTtsInput
  itemStem: string
  workspaceDir: string
}

export type TtsBatchItemAccumulator = {
  index: number
  inputPath: string
  itemStem: string
  characterCount: number
  metadata: Step4Metadata[]
  runs: PreparedTtsRun[]
  errors: string[]
}
