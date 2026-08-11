import type { ActualCostBreakdown, AggregatedPriceEstimate, EstimatedCostBreakdown, GenericTtsDialoguePlan, GenericTtsSourceIdentity, PipelineProviderState, Step4Metadata, StepTimingBreakdown, TtsBatchEstimateSummary } from '~/types'

export type PreparedTtsInput = {
  inputPath: string
  manifestInputPath: string
  sourceBytes: Uint8Array
  text: string
  sourceIdentity: GenericTtsSourceIdentity
  dialoguePlan: GenericTtsDialoguePlan
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
  providerStates: Map<string, PipelineProviderState>
}
