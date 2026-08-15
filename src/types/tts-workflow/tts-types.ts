import type { ComicDialoguePlan, ComicSourceIdentity, HostedConcurrencyRuntimeOptions, ProtectedAssetRef, ProviderLaneAdmissionToken, ProviderLaneIdentity, ProviderLanePressureFeedback, ProviderTargetBase, ResourceGate, Step4Metadata, TtsProvider, TtsRuntimeOptions, VoiceReferenceManifest } from '~/types'

export type TtsOptions = HostedConcurrencyRuntimeOptions & Partial<TtsRuntimeOptions & {
  ttsProviderConcurrency: number
  ttsLocalConcurrency: number
  ttsChunkConcurrency: number
}> & {
  generationResourceGate?: ResourceGate | undefined
  hostedTtsChunkScheduler?: HostedTtsChunkScheduler | undefined
  hostedTtsChunkJobContext?: HostedTtsChunkJobContext | undefined
  hostedTtsLaneScopeLabel?: string | undefined
  /** Explicit one-run authorization to repurchase a slot whose prior provider admission has no recoverable output. */
  ttsAllowAmbiguousRedispatch?: boolean | undefined
  /** Execution-only cap for unresolved immutable generation slots; omitted for an unbounded render. */
  ttsMaxGenerationSlots?: number | undefined
  /**
   * Internal synthesis input for canonical dialogue turns. This is deliberately not part of
   * TtsRuntimeOptions or config persistence: callers must bind controls to the immutable turn ID
   * and provider before render planning.
   */
  ttsTurnControls?: TtsTurnControls | undefined
  /** Internal canonical dialogue sequence used by structured callers after source planning. */
  ttsCanonicalTurns?: readonly {
    turnId: string
    speaker: string
    text: string
    /** Provider-ready request texts for a segmented comic turn, in immutable render-plan order. */
    providerSegments?: readonly string[] | undefined
    /** Original zero-based segment indexes when an execution checkpoint selects a subset. */
    providerSegmentIndexes?: readonly number[] | undefined
  }[] | undefined
  /** Internal mastering contract used by comic audio; it is not a config or generic CLI option. */
  ttsMasteringProfile?: TtsMasteringProfile | undefined
}

export type TtsMasteringProfile = {
  schemaVersion: 1
  sampleRate: number
  channels: 1 | 2
  codec: 'pcm_s16le' | 'pcm_s24le'
  container: 'wav'
}

export type ComicTtsRenderContext = {
  operation: 'comic-audio'
  sourceIdentity: ComicSourceIdentity
  dialoguePlan: ComicDialoguePlan
  voiceSnapshot: VoiceReferenceManifest
  snapshotEntryIdByTurnId: Readonly<Record<string, string>>
  providerSpeakerLabelByTurnId: Readonly<Record<string, string>>
  modePreference: 'auto' | 'native' | 'segmented'
  deliveryPolicy?: 'strict' | 'best-effort' | undefined
  deliveryDispositionByTurnId?: Readonly<Record<string, 'none' | 'serialized' | 'unsupported-best-effort'>> | undefined
  /** Bounded native alternatives. More than one requires an explicit deterministic policy. */
  nativeTakeCount?: number | undefined
  nativeTakeSelectionPolicy?: 'manual' | 'first-generated' | undefined
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
  /** Zero-based provider segment within one canonical turn. Omitted for whole-turn/native calls. */
  providerSegmentIndex?: number | undefined
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

export type TtsTimingIdentity = Readonly<{ turnId: string, subjectKey: string }>
export type TtsTimingFactory = (identity: TtsTimingIdentity) => import('./script-to-audio-types').NormalizedTiming<'take-audio-ms'>

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
    timing?: import('./script-to-audio-types').NormalizedTiming<'take-audio-ms'> | undefined
    timingFactory?: TtsTimingFactory | undefined
    providerGenerationId?: string | undefined
    warnings?: readonly string[] | undefined
  }) => Promise<void>
  complete: (request: { chunkIndex: number }) => Promise<void>
}>

export type HostedTtsChunkRateLimitFeedback = Partial<ProviderLanePressureFeedback>

export type HostedTtsChunkJobContext = {
  jobId?: string | undefined
  label?: string | undefined
  inputIndex?: number | undefined
  targetIndex?: number | undefined
  turnIndex?: number | undefined
  segmentIndex?: number | undefined
  originalOrder?: number | undefined
}

export type HostedTtsChunkAdmissionToken = ProviderLaneAdmissionToken<TtsProvider, Readonly<HostedTtsChunkJobContext>> & Readonly<{
  chunkIndex: number
  internalJobId: number
}>

export type HostedTtsChunkSchedulerSnapshot = {
  provider: TtsProvider
  lane: ProviderLaneIdentity<TtsProvider>
  scopeLabel: string
  laneKey: string
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
  laneKey: string
  previousLimit: number
  nextLimit: number
  reason: 'rate-limit' | 'success-ramp' | 'startup-ramp' | 'recovery-ramp' | 'registered-cap'
}

export type HostedTtsSchedulerProviderSummary = {
  provider: TtsProvider
  lane?: ProviderLaneIdentity<TtsProvider> | undefined
  scopeLabel?: string | undefined
  laneKey?: string | undefined
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
  scopeLabel?: string | undefined
  laneKey?: string | undefined
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
  hostedConcurrency?: import('~/types').HostedConcurrencyTelemetry | undefined
}

export type HostedTtsRunChunksOptions = {
  job?: HostedTtsChunkJobContext | undefined
  scopeLabel?: string | undefined
  abortSignal?: AbortSignal | undefined
}

export type HostedTtsChunkScheduler = {
  runChunks: <T>(
    provider: TtsProvider,
    chunks: readonly string[],
    runChunk: (chunk: string, index: number, admission: HostedTtsChunkAdmissionToken) => Promise<T>,
    options?: HostedTtsRunChunksOptions | undefined
  ) => Promise<T[]>
  notifyRateLimit: (
    admission: HostedTtsChunkAdmissionToken,
    feedback?: HostedTtsChunkRateLimitFeedback | undefined,
    error?: unknown
  ) => Promise<boolean>
  notifyRetry: (admission: HostedTtsChunkAdmissionToken) => void
  usesSharedHostedRateLimitRecovery: () => boolean
  getProviderSnapshot: (provider: TtsProvider, scopeLabel?: string | undefined) => HostedTtsChunkSchedulerSnapshot
  getTelemetry: () => HostedTtsSchedulerTelemetry
}

export type HostedTtsBatchCoordinator = HostedTtsChunkScheduler & {
  start: () => void
  isStarted: () => boolean
  getRegisteredJobCount: () => number
  waitForRegisteredJobs: (count: number, timeoutMs?: number | undefined) => Promise<boolean>
}

export type TtsTarget = ProviderTargetBase<TtsProvider> & {
  operation?: 'tts-synthesis' | 'comic-audio' | undefined
  targetKey?: string | undefined
  transport?: string | undefined
  protectedVoiceAsset?: ProtectedAssetRef | undefined
  protectedSpeakerVoiceAssets?: Readonly<Record<string, ProtectedAssetRef>> | undefined
  /** Stable IDs inspected read-only at the all-target execution-readiness barrier. */
  readinessVoiceIds?: readonly string[] | undefined
  /** Allows resume to append a replacement plan after a definitive failed attempt when an implicit adapter default changed. */
  allowFailedImplicitDefaultReplan?: boolean | undefined
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
