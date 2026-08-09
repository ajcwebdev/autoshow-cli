import type { ProcessingOptions, ProviderTargetBase, ResourceGate, Step4Metadata, TtsProvider, TtsRuntimeOptionKey } from '~/types'
export type TtsOptions = Pick<
  ProcessingOptions,
  TtsRuntimeOptionKey | 'ttsProviderConcurrency' | 'ttsLocalConcurrency' | 'ttsChunkConcurrency'
> & {
  generationResourceGate?: ResourceGate | undefined
  hostedTtsChunkScheduler?: HostedTtsChunkScheduler | undefined
}

export type MultiSpeakerStrategy = 'native' | 'segment-and-concat'

export type SpeakerVoiceMapping = {
  speaker: string
  normalizedSpeaker: string
  voice: string
  voiceKind: 'id' | 'ref-audio'
}

export type SpeakerVoiceRegistry = {
  entries: SpeakerVoiceMapping[]
  bySpeaker: Map<string, SpeakerVoiceMapping>
}

export type HostedTtsChunkRateLimitFeedback = {
  retryAfterMs?: number | undefined
  delayMs?: number | undefined
}

export type HostedTtsChunkRetryFeedback = {
  status?: number | undefined
}

export type HostedTtsChunkJobContext = {
  jobId?: string | undefined
  label?: string | undefined
  inputIndex?: number | undefined
  targetIndex?: number | undefined
  segmentIndex?: number | undefined
  originalOrder?: number | undefined
}

export type HostedTtsChunkSchedulerSnapshot = {
  provider: TtsProvider
  maxLimit: number
  currentLimit: number
  active: number
  queued: number
  pauseUntilMs: number
  successStreak: number
}

export type HostedTtsMetricSummary = {
  totalMs: number
  maxMs: number
  p50Ms: number
  p95Ms: number
}

export type HostedTtsSchedulerLimitChange = {
  atMs: number
  provider: TtsProvider
  previousLimit: number
  nextLimit: number
  reason: 'rate-limit' | 'success-ramp'
}

export type HostedTtsSchedulerProviderSummary = {
  provider: TtsProvider
  maxLimit: number
  currentLimit: number
  startedChunks: number
  completedChunks: number
  failedChunks: number
  retryCount: number
  rateLimitCount: number
  maxActive: number
  queueWait: HostedTtsMetricSummary
  activeLatency: HostedTtsMetricSummary
  pauseTimeMs: number
  limitChanges: HostedTtsSchedulerLimitChange[]
}

export type HostedTtsSchedulerJobSummary = HostedTtsChunkJobContext & {
  provider: TtsProvider
  chunkCount: number
  startedChunks: number
  completedChunks: number
  failedChunks: number
  retryCount: number
  rateLimitCount: number
  queueWait: HostedTtsMetricSummary
  activeLatency: HostedTtsMetricSummary
}

export type HostedTtsSchedulerTelemetry = {
  providers: HostedTtsSchedulerProviderSummary[]
  jobs: HostedTtsSchedulerJobSummary[]
}

export type HostedTtsRunChunksOptions = {
  job?: HostedTtsChunkJobContext | undefined
}

export type HostedTtsChunkScheduler = {
  runChunks: <T>(
    provider: TtsProvider,
    chunks: readonly string[],
    runChunk: (chunk: string, index: number) => Promise<T>,
    options?: HostedTtsRunChunksOptions | undefined
  ) => Promise<T[]>
  notifyRateLimit: (provider: TtsProvider, feedback?: HostedTtsChunkRateLimitFeedback | undefined) => void
  notifyRetry: (provider: TtsProvider, feedback?: HostedTtsChunkRetryFeedback | undefined) => void
  getProviderSnapshot: (provider: TtsProvider) => HostedTtsChunkSchedulerSnapshot
  getTelemetry: () => HostedTtsSchedulerTelemetry
}

export type HostedTtsBatchCoordinator = HostedTtsChunkScheduler & {
  start: () => void
  isStarted: () => boolean
  getRegisteredJobCount: () => number
  waitForRegisteredJobs: (count: number, timeoutMs?: number | undefined) => Promise<boolean>
}

export type TtsTarget = ProviderTargetBase<TtsProvider> & {
  voice?: string
  multiSpeakerStrategy?: MultiSpeakerStrategy
  setupCostCents?: number | undefined
  setupTimeMs?: number | undefined
  setupNote?: string | undefined
  run: (text: string, outputDir: string, opts: TtsOptions) => Promise<{ audioPath: string, metadata: Step4Metadata }>
}


export type TtsCustomVoiceSampleAudio = {
  path: string
  basename: string
  mimeType: string
  sizeBytes: number
  durationSeconds?: number | undefined
}
