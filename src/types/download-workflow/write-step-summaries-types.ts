import type { ActualCostBreakdown, ProcessingOptions, Step2Metadata, Step3Metadata } from '~/types'

type ActualCostSteps = ActualCostBreakdown['steps']

export type BuildWriteStepSummariesContext = {
  processingOptions: ProcessingOptions
  step1Time: number
  step2Entries: Step2Metadata[]
  step3Results: Step3Metadata[]
  actualSteps: ActualCostSteps
}
