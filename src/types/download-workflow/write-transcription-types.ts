import type { MistralSttPassController, PreparedSttMedia, ProcessingOptions, RuntimeOptions, Step2Metadata, SttProviderSuccess, SttTarget, TranscriptionResult } from '~/types'

export type ProcessVideoRuntimeOptions = Pick<RuntimeOptions, 'outputRootDir' | 'sttProviderConcurrency' | 'sttLocalConcurrency' | 'sttSegmentConcurrency'>
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
