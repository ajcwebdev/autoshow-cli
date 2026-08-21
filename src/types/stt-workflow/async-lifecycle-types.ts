import type { AsyncSttLifecycleHooks, Step2Metadata, Step2RuntimeMetadata, TranscriptionResult } from '~/types'

export type AsyncSttLifecycleMetrics = {
  uploadMs: number
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

export type AsyncSttUploadAssetResult<TUpload> = {
  value: TUpload
  remoteAssetId?: string | undefined
  remoteAssetUrl?: string | undefined
}

export type AsyncSttPoll<TStatus> = {
  status: TStatus
  retryAfterMs: number | null
}

/**
 * Creation either hands back a job to poll, or — for providers that can answer a small
 * request synchronously — the finished transcript itself. `kind` is optional on the job
 * branch so adapters that can only ever return a job stay unchanged.
 */
type AsyncSttCreateJobResult<TStatus, TTranscript> =
  | { kind?: 'job' | undefined, jobId: string, status?: TStatus | undefined }
  | { kind: 'completed', transcript: TTranscript }

type AsyncSttActiveJob<TStatus> = {
  jobId: string
  resumedExistingJob: boolean
  initialStatus?: TStatus | undefined
}

type AsyncSttLifecycleResultBuilderParams<TTranscript> = {
  transcript: TTranscript
  /** Absent when creation returned the transcript directly, so no remote job exists. */
  runtime: Step2RuntimeMetadata | undefined
  processingTime: number
  timings?: Step2Metadata['timings'] | undefined
}

export type AsyncSttLifecycleOptions<TStatus, TTranscript, TUpload = unknown> = {
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
  segment?: {
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
  } | undefined
  jobNoun?: string | undefined
  guardStage?: string | undefined
  uploadAsset?: ((metrics: AsyncSttLifecycleMetrics) => Promise<AsyncSttUploadAssetResult<TUpload>>) | undefined
  createJob: (
    metrics: AsyncSttLifecycleMetrics,
    upload: AsyncSttUploadAssetResult<TUpload> | undefined
  ) => Promise<AsyncSttCreateJobResult<TStatus, TTranscript>>
  pollJob: (jobId: string, metrics: AsyncSttLifecycleMetrics) => Promise<AsyncSttPoll<TStatus>>
  getTranscript: (jobId: string, metrics: AsyncSttLifecycleMetrics, finalStatus: TStatus) => Promise<TTranscript>
  isComplete: (status: TStatus) => boolean
  isFailed: (status: TStatus) => string | undefined
  buildDeadlineError: (jobId: string, pollDeadlineMs: number, cause?: unknown) => never
  buildResumeProbeError: (jobId: string, probeCount: number, totalWaitMs: number, cause?: unknown) => never
  persistCompletedProgress?: boolean | undefined
  extendProgressMetadata?: ((runtime: Step2RuntimeMetadata) => Partial<Pick<Step2Metadata, 'billing'>>) | undefined
  cleanup?: {
    shouldDelete: (context: {
      metadata: Step2Metadata | undefined
      lastKnownStatus: TStatus | undefined
      runtime: Step2RuntimeMetadata | undefined
    }) => boolean
    deleteJob?: ((jobId: string) => Promise<boolean>) | undefined
    deleteAsset?: ((assetId: string) => Promise<boolean>) | undefined
  } | undefined
  buildResult: (
    params: AsyncSttLifecycleResultBuilderParams<TTranscript>
  ) => Promise<{ result: TranscriptionResult, metadata: Step2Metadata }>
}

export type AsyncSttLifecycleCleanupSnapshot<TStatus, TUpload> = {
  runtime?: Step2RuntimeMetadata | undefined
  jobId?: string | undefined
  lastKnownStatus?: TStatus | undefined
  uploadedAsset?: AsyncSttUploadAssetResult<TUpload> | undefined
  metadata?: Step2Metadata | undefined
}

export type AsyncSttLifecycleCleanupState<TStatus, TUpload> = {
  snapshot: () => Readonly<AsyncSttLifecycleCleanupSnapshot<TStatus, TUpload>>
  setRuntime: (runtime: Step2RuntimeMetadata) => void
  setJob: (jobId: string, status: TStatus | undefined) => void
  setLastKnownStatus: (status: TStatus) => void
  setUploadedAsset: (uploadedAsset: AsyncSttUploadAssetResult<TUpload>) => void
  setMetadata: (metadata: Step2Metadata) => void
}

export type AsyncSttLifecycleContext<TStatus, TTranscript, TUpload = unknown> = {
  options: AsyncSttLifecycleOptions<TStatus, TTranscript, TUpload>
  metrics: AsyncSttLifecycleMetrics
  cleanupState: AsyncSttLifecycleCleanupState<TStatus, TUpload>
  persistProgressMetadata: (runtime: Step2RuntimeMetadata) => Promise<void>
  notifyJobReady: (runtime: Step2RuntimeMetadata) => Promise<void>
  buildTimingMetadata: (remoteProcessingMs?: number) => Step2Metadata['timings']
}

export type AsyncSttActiveJobContext<TStatus, TTranscript, TUpload = unknown> =
  AsyncSttLifecycleContext<TStatus, TTranscript, TUpload> & {
    activeJob: AsyncSttActiveJob<TStatus>
    runtime: Step2RuntimeMetadata
    uploadedAsset?: AsyncSttUploadAssetResult<TUpload> | undefined
  }

export type AsyncSttPolledJobContext<TStatus, TTranscript, TUpload = unknown> =
  AsyncSttActiveJobContext<TStatus, TTranscript, TUpload> & {
    finalStatus: TStatus
    completedRuntime: Step2RuntimeMetadata
  }

export type AsyncSttCompletedJobContext<TStatus, TTranscript, TUpload = unknown> =
  AsyncSttPolledJobContext<TStatus, TTranscript, TUpload> & {
    built: { result: TranscriptionResult, metadata: Step2Metadata }
  }

/** Creation resolved a job to poll, or already produced the transcript. */
export type AsyncSttCreationOutcome<TStatus, TTranscript, TUpload = unknown> =
  | { kind: 'job', context: AsyncSttActiveJobContext<TStatus, TTranscript, TUpload> }
  | { kind: 'completed', transcript: TTranscript }

type AsyncSttPollMode = 'fresh' | 'resume-probe'

export type AsyncSttPollLoopOptions<TStatus> = {
  jobId: string
  initialPollIntervalMs: number
  maxPollIntervalMs: number
  audioDurationSeconds?: number | undefined
  pollMode?: AsyncSttPollMode | undefined
  poll: () => Promise<AsyncSttPoll<TStatus>>
  isComplete: (status: TStatus) => boolean
  isFailed: (status: TStatus) => string | undefined
  buildDeadlineError: (jobId: string, pollDeadlineMs: number, cause?: unknown) => never
  buildResumeProbeError?: ((jobId: string, probeCount: number, totalWaitMs: number, cause?: unknown) => never) | undefined
  onProgress?: ((status: TStatus) => Promise<void> | void) | undefined
  withPollSlot?: (<T>(fn: () => Promise<T>) => Promise<T>) | undefined
}
