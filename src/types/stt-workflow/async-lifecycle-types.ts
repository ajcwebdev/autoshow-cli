import type { AsyncSttLifecycleHooks, Step2Metadata, Step2RuntimeMetadata, TranscriptionResult } from '~/types'

export type AsyncSttLifecycleMetrics = {
  createMs: number
  pollMs: number
  pollSleepMs: number
  transcriptMs: number
  createCount: number
  pollCount: number
  requestCount: number
  retryCount: number
  rateLimitCount: number
  backfillCount: number
}

export type AsyncSttCreateJobResult<TStatus> = {
  jobId: string
  status?: TStatus | undefined
}

export type AsyncSttLifecycleResultBuilderParams<TTranscript> = {
  transcript: TTranscript
  runtime: Step2RuntimeMetadata
  processingTime: number
  timings?: Step2Metadata['timings'] | undefined
}

export type AsyncSttLifecycleOptions<TStatus, TTranscript> = {
  outputDir: string
  providerService: Step2Metadata['transcriptionService']
  providerLogLabel: string
  providerDisplayName: string
  modelName: string
  startTime: number
  runMode?: 'initial' | 'backfill' | undefined
  lifecycle?: AsyncSttLifecycleHooks | undefined
  audioDurationSeconds?: number | undefined
  initialPollIntervalMs: number
  maxPollIntervalMs: number
  createJob: (metrics: AsyncSttLifecycleMetrics) => Promise<AsyncSttCreateJobResult<TStatus>>
  pollJob: (jobId: string, metrics: AsyncSttLifecycleMetrics) => Promise<{ status: TStatus, retryAfterMs: number | null }>
  getTranscript: (jobId: string, metrics: AsyncSttLifecycleMetrics) => Promise<TTranscript>
  isComplete: (status: TStatus) => boolean
  isFailed: (status: TStatus) => string | undefined
  buildDeadlineError: (jobId: string, pollDeadlineMs: number) => never
  buildResumeProbeError: (jobId: string, probeCount: number, totalWaitMs: number) => never
  deleteJob: (jobId: string) => Promise<boolean>
  shouldDeleteRemoteJob: (context: {
    metadata: Step2Metadata | undefined
    lastKnownStatus: TStatus | undefined
  }) => boolean
  buildResult: (
    params: AsyncSttLifecycleResultBuilderParams<TTranscript>
  ) => Promise<{ result: TranscriptionResult, metadata: Step2Metadata }>
}

export type AsyncSttPollMode = 'fresh' | 'resume-probe'

export type AsyncSttPollLoopOptions<TStatus> = {
  jobId: string
  initialPollIntervalMs: number
  maxPollIntervalMs: number
  audioDurationSeconds?: number | undefined
  pollMode?: AsyncSttPollMode | undefined
  poll: () => Promise<{ status: TStatus, retryAfterMs: number | null }>
  isComplete: (status: TStatus) => boolean
  isFailed: (status: TStatus) => string | undefined
  buildDeadlineError: (jobId: string, pollDeadlineMs: number) => never
  buildResumeProbeError?: ((jobId: string, probeCount: number, totalWaitMs: number) => never) | undefined
  onProgress?: ((status: TStatus) => Promise<void> | void) | undefined
  withPollSlot?: (<T>(fn: () => Promise<T>) => Promise<T>) | undefined
}
