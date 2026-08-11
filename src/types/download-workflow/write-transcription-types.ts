import type { MistralSttPassController, PreparedSttMedia, ProcessingOptions, SharedPipelineOptions, Step2Metadata, SttProviderSuccess, SttRuntimeOptions, SttTarget, TranscriptionResult } from '~/types'

export type ProcessVideoRuntimeOptions = Pick<SharedPipelineOptions, 'outputRootDir'>
  & Pick<SttRuntimeOptions, 'sttProviderConcurrency' | 'sttLocalConcurrency' | 'sttSegmentConcurrency'>
  & { outputDir?: string | undefined }

export type WriteSttFailure = {
  service: string
  model: string
  message: string
  retryable: boolean
  skipped?: boolean | undefined
  stage?: string | undefined
  status?: number | undefined
}

export type WriteTranscriptionBundle = {
  result: TranscriptionResult
  metadata: Step2Metadata | Step2Metadata[]
}

export type ResolveWriteTranscriptionContext = {
  processingOptions: ProcessingOptions
  outputDir: string
  sttTargets: SttTarget[]
  audioPath: string
  preparedMedia: PreparedSttMedia
  runtimeOptions?: ProcessVideoRuntimeOptions | undefined
  mistralPassController?: MistralSttPassController | undefined
}

export type ResolveWriteTranscriptionResult = {
  transcriptionResult: WriteTranscriptionBundle | undefined
  successfulSttProviders: SttProviderSuccess[]
  sttFailures: WriteSttFailure[]
}
