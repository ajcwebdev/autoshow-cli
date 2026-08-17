import type { AggregatedPriceEstimate, ProcessingOptions, Step1Metadata, Step3Metadata, WriteTranscriptionBundle } from '~/types'

export type ComputeWriteCostAndTimingContext = {
  processingOptions: ProcessingOptions
  preflightEstimate?: AggregatedPriceEstimate | undefined
  step1Metadata: Step1Metadata
  transcriptionResult: WriteTranscriptionBundle
  mediaDurationSeconds: number
  step3Results: Step3Metadata[]
  step3Serialized: Step3Metadata | Step3Metadata[] | undefined
}
