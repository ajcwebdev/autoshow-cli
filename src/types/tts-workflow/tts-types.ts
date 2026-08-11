import type { ProtectedAssetRef, ProviderTargetBase, ResourceGate, Step4Metadata, TtsProvider, TtsRuntimeOptions } from '~/types'

export type TtsOptions = Partial<TtsRuntimeOptions & {
  ttsProviderConcurrency: number
  ttsLocalConcurrency: number
  ttsChunkConcurrency: number
}> & {
  generationResourceGate?: ResourceGate | undefined
  hostedTtsChunkScheduler?: HostedTtsChunkScheduler | undefined
  /**
   * Internal synthesis input for canonical dialogue turns. This is deliberately not part of
   * TtsRuntimeOptions or config persistence: callers must bind controls to the immutable turn ID
   * and provider before render planning.
   */
  ttsTurnControls?: TtsTurnControls | undefined
}

export type MultiSpeakerStrategy = 'native' | 'segment-and-concat'
export type GeminiDialogueMode = 'auto' | 'native' | 'segmented'

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

export type TtsTargetVoiceSource =
  | Readonly<{ kind: 'id', value: string }>
  | Readonly<{
      kind: 'ref-audio'
      value: string
      protectedAsset?: ProtectedAssetRef | undefined
      authorizationRef?: string | undefined
    }>

export type TtsTargetInvocationControlValue = string | number | boolean | null | readonly string[]

export type TtsTargetInvocationControls = Readonly<Record<string, TtsTargetInvocationControlValue>>

export type TtsTurnControls = Readonly<Record<
  string,
  Readonly<Partial<Record<TtsProvider, TtsTargetInvocationControls>>>
>>

export type TtsTargetInvocation = Readonly<{
  sourceId: string
  sourceIndex: number
  speaker: string
  voice: TtsTargetVoiceSource
  controls: TtsTargetInvocationControls
  signal?: AbortSignal | undefined
}>

export type TtsSerializedVoiceObservation = Readonly<{
  kind: 'provider-id' | 'reference-asset' | 'local-model-voice'
  value?: string | undefined
  valueHash?: string | undefined
  speaker?: string | undefined
}>

export type TtsSerializedRequestObservation = Readonly<{
  chunkIndex: number
  endpointKind: string
  serializerVersion: string
  serializedRequest: unknown
  providerText: string
  voiceField: string
  voices: readonly TtsSerializedVoiceObservation[]
  requestControls?: unknown
  continuation?: unknown
}>

export type TtsProviderRequestAttempt = Readonly<{
  attempt: number
  retryReasonCode?: string | undefined
}>

export type TtsProviderRequestAcceptance = Readonly<{
  providerRequestId?: string | undefined
  fields?: Readonly<Record<string, string | number | boolean | null>> | undefined
}>

export type TtsProviderRequestLifecycle = Readonly<{
  accepted: (acceptance?: TtsProviderRequestAcceptance | undefined) => Promise<void>
}>

export type TtsRequestEvidenceScope = Readonly<{
  forInvocation?: ((invocation: TtsTargetInvocation) => TtsRequestEvidenceScope) | undefined
  /** Returns verified retained outputs only when every planned slot in this invocation is complete. */
  recoverCompletedOutputs?: (() => Promise<Readonly<{
    paths: readonly string[]
    generationSlotIds: readonly string[]
  }> | undefined>) | undefined
  dispatch: <T>(
    observation: TtsSerializedRequestObservation,
    requestAttempt: TtsProviderRequestAttempt,
    operation: (lifecycle: TtsProviderRequestLifecycle) => Promise<T>
  ) => Promise<T>
  recordOutput: (output: {
    chunkIndex: number
    path: string
    outputIndex?: number | undefined
  }) => Promise<void>
  complete: (request: { chunkIndex: number }) => Promise<void>
}>

export type HostedTtsChunkRateLimitFeedback = {
  retryAfterMs?: number | undefined
  delayMs?: number | undefined
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
  abortSignal?: AbortSignal | undefined
}

export type HostedTtsChunkScheduler = {
  runChunks: <T>(
    provider: TtsProvider,
    chunks: readonly string[],
    runChunk: (chunk: string, index: number) => Promise<T>,
    options?: HostedTtsRunChunksOptions | undefined
  ) => Promise<T[]>
  notifyRateLimit: (provider: TtsProvider, feedback?: HostedTtsChunkRateLimitFeedback | undefined) => void
  notifyRetry: (provider: TtsProvider) => void
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
  operation?: 'tts-synthesis' | undefined
  targetKey?: string | undefined
  transport?: string | undefined
  protectedVoiceAsset?: ProtectedAssetRef | undefined
  protectedSpeakerVoiceAssets?: Readonly<Record<string, ProtectedAssetRef>> | undefined
  voice?: string
  multiSpeakerStrategy?: MultiSpeakerStrategy
  setupCostCents?: number | undefined
  setupTimeMs?: number | undefined
  setupNote?: string | undefined
  run: (
    text: string,
    outputDir: string,
    opts: TtsOptions,
    invocation?: TtsTargetInvocation | undefined,
    requestEvidence?: TtsRequestEvidenceScope | undefined
  ) => Promise<{ audioPath: string, metadata: Step4Metadata }>
}


export type TtsCustomVoiceSampleAudio = {
  path: string
  basename: string
  mimeType: string
  sizeBytes: number
  durationSeconds?: number | undefined
}
