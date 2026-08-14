import type * as v from 'valibot'
import type { AggregatedPriceEstimate, BatchChildRunContext, DeepgramResponse, DiarizationOptions, GladiaStatusResponse, ProviderCompletionStatus, ProviderErrorSummaryFields, ProviderIdentityBase, ProviderRunStateBase, ProviderSuccess, RetryClass, SecondsTimedTextRangeBase, Step1Metadata, Step2Metadata, Step2RuntimeMetadata, SttExtractionOptions, TranscribeEngine, TranscriptionResult, VideoMetadata, YtDlpVideoInfo } from '~/types'
import {
RevJobSchema,
RevTranscriptResponseSchema,
SonioxTranscriptionStatusSchema,
SonioxTranscriptResponseSchema,
SpeechmaticsJobSchema,
SpeechmaticsTranscriptResponseSchema
} from '~/types'

export type SttBatchCoordinator =
  import('~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch-coordinator').SttBatchCoordinator

export type MistralSttPassController =
  import('~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-mistral/mistral-stt-pass-controller').MistralSttPassController

export type TranscribeEngineCapabilities = {
  diarizationByDefault: boolean
  supportsSpeakerCountHint: boolean
}

export type EmbeddedJson = {
  text?: string
  segments?: Array<{
    start?: number
    end?: number
    text?: string
    speaker?: string
  }>
}

export type RawTranscriptionPayload = {
  text?: unknown
  segments?: unknown
}


export type SonioxTranscriptionStatus = v.InferOutput<typeof SonioxTranscriptionStatusSchema>
export type SonioxTranscriptResponse = v.InferOutput<typeof SonioxTranscriptResponseSchema>
export type RevJob = v.InferOutput<typeof RevJobSchema>
export type RevTranscriptResponse = v.InferOutput<typeof RevTranscriptResponseSchema>
export type SpeechmaticsJob = v.InferOutput<typeof SpeechmaticsJobSchema>
export type SpeechmaticsTranscriptResponse = v.InferOutput<typeof SpeechmaticsTranscriptResponseSchema>

export type Step2TimingMetadata = {
  queueWaitMs?: number | undefined
  transcribeMs?: number | undefined
  uploadMs?: number | undefined
  createMs?: number | undefined
  createCount?: number | undefined
  pollMs?: number | undefined
  pollSleepMs?: number | undefined
  pollCount?: number | undefined
  transcriptMs?: number | undefined
  remoteProcessingMs?: number | undefined
  cleanupMs?: number | undefined
  requestCount?: number | undefined
  retryCount?: number | undefined
  rateLimitCount?: number | undefined
  blockedCount?: number | undefined
  degradedCount?: number | undefined
  backfillCount?: number | undefined
}


export type SttTarget = ProviderIdentityBase<TranscribeEngine> & {
  local: boolean
  diarizationOptions?: DiarizationOptions | undefined
}

export type ProviderFailure = SttProviderFailureSummary & {
  index: number
  service: SttTarget['service']
  model: string
}

export type ProcessSttRunOptions = {
  outputDir?: string | undefined
  requestedTargets?: SttTarget[] | undefined
  targetsToRun?: SttTarget[] | undefined
  batchCoordinator?: SttBatchCoordinator | undefined
  mistralPassController?: MistralSttPassController | undefined
  batchChildContext?: BatchChildRunContext | undefined
}

export type PromptSelectionCandidate = SttProviderSuccess

export type ProviderErrorLike = Error & {
  cause?: unknown
  headers?: Headers
  retryClass?: RetryClass
  stage?: string
  status?: number
  retryable?: boolean
  skipped?: boolean
  rawResponse?: unknown
}

export type EffectiveSttProviderConcurrency = {
  requested: number
  effective: number
  hostedProviderCount: number
}


export type PreparedSttMedia = {
  metadata: VideoMetadata
  sourceVideoInfo?: YtDlpVideoInfo | undefined
  step1Metadata: Step1Metadata
  durationSeconds: number
  executionArtifacts: {
    sourceMediaPath: string
  }
  outputArtifacts: {
    sourceMediaPath: string
  }
  timings: {
    sourceMediaMs?: number | undefined
  }
  cleanup?: (() => Promise<void>) | undefined
}

export type SttCompletionContextBase = {
  outputDir: string
  requestedTargets: SttTarget[]
  options: SttExtractionOptions
  preflightEstimate?: AggregatedPriceEstimate | undefined
  prepared: PreparedSttMedia
  acquisitionTimeMs: number
  processStart: number
}

export type SttRequestedProvider = Pick<SttTarget, 'service' | 'model' | 'local' | 'diarizationOptions'>

export type SttRecordedProviderError = ProviderErrorSummaryFields & {
  skipped?: boolean | undefined
}

export type SttProviderFailureSummary = ProviderErrorSummaryFields & {
  retryable: boolean
  skipped?: boolean | undefined
}

export type SttProviderState = ProviderRunStateBase<SttTarget['service'], SttRecordedProviderError> & {
  local: boolean
}

export type SttProviderSuccess = ProviderSuccess<SttTarget, Step2Metadata, TranscriptionResult>

export type ExistingSttRun = {
  successes: Array<SttProviderSuccess | undefined>
  providerStates: Map<string, SttProviderState>
}

export type SttBatchProviderProfile = {
  kind: 'sync' | 'async'
  launchSlotLimit: number
  pollSlotLimit: number
}

export type SttProviderSlotSummary = {
  service: SttTarget['service']
  model: string
  provider: string
  kind: 'sync' | 'async'
  launchSlots: number
  pollSlots: number | null
}

export type SttBatchBlockedProviderReason = {
  service: SttTarget['service']
  model: string
  local: boolean
  message: string
  retryable: boolean
  stage?: string | undefined
  status?: number | undefined
  degraded?: boolean | undefined
}


export type SttBatchProviderStatsSnapshot = {
  lane: import('~/types').ProviderLaneIdentity<SttTarget['service']>
  service: SttTarget['service']
  model: string
  kind: 'sync' | 'async'
  launchSlotLimit: number
  pollSlotLimit: number
  launchedCount: number
  completedCount: number
  blockedCount: number
  degradedCount: number
  queueWaitMs: number
  pollCount: number
  backfillCount: number
  warmupComplete: boolean
}

export type SttBatchSchedulerSnapshot = {
  providers: SttBatchProviderStatsSnapshot[]
}

export type AvailabilityWaiter = {
  resolved: boolean
  notify: () => void
  timer?: ReturnType<typeof setTimeout> | undefined
}

export type ProviderState = {
  activeCount: number
  pollActiveCount: number
  blockedReason?: SttBatchBlockedProviderReason | undefined
  waiters: AvailabilityWaiter[]
  pollWaiters: AvailabilityWaiter[]
  cooldownUntil?: number | undefined
  warmupComplete: boolean
  consecutiveRetryableFailures: number
  stats: {
    launchedCount: number
    completedCount: number
    blockedCount: number
    degradedCount: number
    queueWaitMs: number
    pollCount: number
    backfillCount: number
  }
}

export type ProviderFailureSummary = Pick<SttProviderFailureSummary, 'message' | 'retryable' | 'stage' | 'status'>


export type WhisperProgressLogContext = {
  segmentNumber?: number | undefined
  totalSegments?: number | undefined
  segmentStartSeconds?: number | undefined
  segmentDurationSeconds?: number | undefined
  totalDurationSeconds?: number | undefined
}


export type AsyncSttLifecycleHooks = {
  onJobReady?: ((runtime: Step2RuntimeMetadata) => Promise<void> | void) | undefined
  withPollSlot?: (<T>(fn: () => Promise<T>) => Promise<T>) | undefined
  readProgressMetadata?: ((progressKey: string) => Promise<Record<string, unknown> | undefined>) | undefined
  writeProgressMetadata?: ((progressKey: string, metadata: Step2Metadata) => Promise<void>) | undefined
}

export type SttTargetOptions = {
  split?: boolean | undefined
  reverbVerbatimicity?: number | undefined
  sttSegmentConcurrency?: number | undefined
  sttProviderConcurrency?: number | undefined
  audioDurationSeconds?: number | undefined
  sourceUrl?: string | undefined
  language?: string | undefined
  happyscribeOrganizationId?: string | undefined
  runMode?: 'initial' | 'backfill' | undefined
  asyncLifecycle?: AsyncSttLifecycleHooks | undefined
  mistralPassController?: MistralSttPassController | undefined
  hostedConcurrencyCoordinator?: import('~/types').HostedConcurrencyCoordinator | undefined
}

export type IndexedTranscriptionChunk = {
  segmentIndex: number
  data: { result: TranscriptionResult, metadata: Step2Metadata }
}


export type AudioSegmentDescriptor = {
  path: string
  segmentNumber: number
  totalSegments: number
  startSeconds: number
  durationSeconds: number
}

type RequiredSttHttpError<TStage extends string> = Error & {
  status: number
  headers: Headers
  stage?: TStage
  retryClass?: RetryClass
}

type RequiredSttHttpErrorWithRawResponse<TStage extends string> = RequiredSttHttpError<TStage> & {
  rawResponse?: unknown
}

export type OptionalSttHttpError<TStage extends string> = Error & {
  status?: number | undefined
  headers?: Headers | undefined
  stage?: TStage | undefined
  retryClass?: RetryClass | undefined
  rawResponse?: unknown
}

export type SttTranscribeHttpError = RequiredSttHttpError<'transcribe'>

export type SttStageHttpError = RequiredSttHttpErrorWithRawResponse<string>

export type SupadataHttpError = OptionalSttHttpError<'create' | 'poll'> & {
  retryable?: boolean
  skipped?: boolean
}

export type SttRequestMetrics = {
  onRequest?: (() => void) | undefined
  onRetry?: ((status: number | undefined) => void) | undefined
}

export type DeepgramAlternative = NonNullable<DeepgramResponse['results']['channels'][number]['alternatives']>[number]
export type DeepgramWords = DeepgramAlternative['words']


export type GladiaUtterance = NonNullable<NonNullable<NonNullable<GladiaStatusResponse['result']>['transcription']>['utterances']>[number]

export type SplitPolicyTarget = Pick<SttTarget, 'service' | 'model'>

export type SttAcquireSummary = {
  item: string
  sourceMedia: string
  elapsedMs: number
  sourceMediaMs?: number | undefined
}

export type SttAsyncJobLifecycle = {
  provider: string
  action: 'created' | 'resumed'
  remoteId: string
  state: string
}

export type SttSegmentLifecycle = {
  provider: string
  action: 'started' | 'completed'
  segmentNumber?: number
  totalSegments?: number
  model?: string
  processingTimeMs?: number
  detail?: string
}

export type SttRunStatusSummary = {
  completionStatus: ProviderCompletionStatus
  requested: number
  succeeded: number
  failed: number
  missing: number
  skipped: number
}

export type SttProviderConcurrencySummary = {
  mode: 'batch_scheduler' | 'cloud_provider_concurrency'
  requested: number
  effective: number
  batchConcurrency: number
  hostedProviders: number
  providerSlots: string
}

export type HappyScribeOrganization = {
  id: string
  name?: string | undefined
  currency?: string | undefined
}

export type HappyScribeOrganizationSelection = {
  selected?: HappyScribeOrganization | undefined
  organizations: HappyScribeOrganization[]
  source?: 'option' | 'env' | 'auto' | undefined
  reason?: 'missing' | 'not_found' | 'ambiguous' | undefined
  requestedOrganizationId?: string | undefined
}

export type HappyScribeStage = 'upload' | 'create' | 'poll' | 'result'

export type HappyScribeHttpError = OptionalSttHttpError<HappyScribeStage> & {
  retryable?: boolean
}

export type HappyScribeOrder = {
  id: string
  state:
    | 'incomplete'
    | 'waiting_for_payment'
    | 'submitted'
    | 'locked'
    | 'fulfilled'
    | 'failed'
    | string
  details?: {
    totalCents?: number | undefined
    totalCredits?: number | undefined
    currency?: string | undefined
  } | undefined
  outputsIds: string[]
  transcriptions: Array<{
    id?: string | undefined
    uuid?: string | undefined
    state?: string | undefined
  }>
}

export type HappyScribeTranscription = {
  id?: string | undefined
  state?: string | undefined
  failureReason?: string | undefined
  failureMessage?: string | undefined
  costInCents?: number | undefined
  downloadUrl?: string | undefined
}

export type HappyScribeExport = {
  id: string
  state: string
  downloadLink?: string | undefined
}

export type MistralAvailabilityWaiter = {
  resolved: boolean
  notify: () => void
}

export type SupadataChunk = {
  text: string
  offset: number
  duration: number
  lang?: string | undefined
}

export type SupadataTranscriptPayload = {
  content: string | SupadataChunk[]
  lang?: string | undefined
  availableLangs?: string[] | undefined
}


export type SupadataJobStatus = {
  status: 'queued' | 'active' | 'completed' | 'failed'
  content?: string | SupadataChunk[] | undefined
  lang?: string | undefined
  availableLangs?: string[] | undefined
  error?: unknown
  message?: unknown
}

export type SttSplitPolicy = {
  attachmentCapBytes?: number | undefined
  maxDurationSeconds?: number | undefined
  requestBudgetSeconds?: number | undefined
}

export type SttSplitDecisionReason =
  | { kind: 'explicit' }
  | { kind: 'attachment_cap', attachmentCapBytes: number, audioFileSizeBytes: number }
  | { kind: 'duration_cap', maxDurationSeconds: number, audioDurationSeconds: number }
  | { kind: 'request_budget', requestBudgetSeconds: number, audioDurationSeconds: number }

export type SttSplitDecision = {
  shouldSplit: boolean
  policy: SttSplitPolicy
  reasons: SttSplitDecisionReason[]
  segmentDurationMinutes: number
}

export type YoutubeCaptionTrack = NonNullable<YtDlpVideoInfo['subtitles']>[string][number]

export type YoutubeCaptionSelection = {
  kind: 'manual' | 'auto'
  language: string
  track: YoutubeCaptionTrack
}

export type ParsedYoutubeCue = SecondsTimedTextRangeBase

export type YoutubeCaptionMetadataFile = {
  captionKind: 'manual' | 'auto'
  captionLanguage: string
  sourceUrl: string
  trackName: string | null
  subtitleInventory: Record<string, Array<{ ext: string, name?: string }>>
  automaticCaptionInventory: Record<string, Array<{ ext: string, name?: string }>>
}
