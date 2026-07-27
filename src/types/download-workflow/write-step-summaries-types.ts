import type { ActualCostBreakdown, ProcessingOptions, Step2Metadata, Step3Metadata, Step4Metadata, Step5Metadata, Step6VideoMetadata, Step7MusicMetadata } from '~/types'

export type ActualCostSteps = ActualCostBreakdown['steps']

export type BuildWriteStepSummariesContext = {
  processingOptions: ProcessingOptions
  step1Time: number
  step2Entries: Step2Metadata[]
  step3Results: Step3Metadata[]
  step4Metadata: Step4Metadata[] | null
  step5Metadata: Step5Metadata[] | null
  step6Metadata: Step6VideoMetadata[] | null
  step7Metadata: Step7MusicMetadata[] | null
  actualSteps: ActualCostSteps
}
