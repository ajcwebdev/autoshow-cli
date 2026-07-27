import type { DocumentMetadata, ExtractionMetadata, HostedOcrSchedulerTelemetry, PartialExtractionMetadata, Step1Metadata, Step2Metadata, Step3Metadata, Step4Metadata, Step5Metadata, Step6VideoMetadata, Step7MusicMetadata } from '~/types'

export type ActualPipelineInputsBase<TStep1> = {
  step1?: TStep1 | undefined
  step2?: Step2Metadata | Step2Metadata[] | ExtractionMetadata | ExtractionMetadata[] | undefined
  partialStep2?: PartialExtractionMetadata | PartialExtractionMetadata[] | undefined
  step3?: Step3Metadata | Step3Metadata[] | undefined
  step4?: Step4Metadata | Step4Metadata[] | undefined
  step5?: Step5Metadata | Step5Metadata[] | undefined
  step6?: Step6VideoMetadata | Step6VideoMetadata[] | undefined
  step7?: Step7MusicMetadata | Step7MusicMetadata[] | undefined
  ttsCharacterCount?: number | undefined
}

export type ComputeActualProcessingTimesInput = ActualPipelineInputsBase<Step1Metadata | DocumentMetadata> & {
  audioDurationSeconds?: number | undefined
  hostedOcrScheduler?: HostedOcrSchedulerTelemetry | undefined
  ocrProviderConcurrency?: number | undefined
  ocrLocalConcurrency?: number | undefined
}
