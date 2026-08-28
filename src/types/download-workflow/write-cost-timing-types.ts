import type { AggregatedPriceEstimate, ProcessingOptions, Step1Metadata, WriteTranscriptionBundle } from '~/types'

export type ComputeWriteCostAndTimingContext = {
  processingOptions: ProcessingOptions
  preflightEstimate?: AggregatedPriceEstimate | undefined
  step1Metadata: Step1Metadata
  transcriptionResult: WriteTranscriptionBundle
  mediaDurationSeconds: number
}
