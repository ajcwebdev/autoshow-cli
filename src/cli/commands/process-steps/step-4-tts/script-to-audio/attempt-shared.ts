import type {
  AnyCapabilityRecord,
  CanonicalAudioProviderProjection,
  CanonicalDialogueTurn,
  ComicTtsRenderContext,
  GenericTtsDialoguePlan,
  GenericTtsSourceIdentity,
  ObservedAudioFormat,
  NormalizedTiming,
  ObservedProviderRequest,
  PipelineProviderState,
  PlannedCost,
  ProviderBatchInvocationPlan,
  ProviderBatchResult,
  ProviderRenderBranchCandidate,
  ProviderRenderBranchPlan,
  ProviderRenderPlan,
  ProviderRenderStrategy,
  ProviderRetryRecord,
  RenderAdmissionJournalSnapshot,
  ResolvedVoiceBinding,
  SanitizedProviderError,
  TtsOptions,
  TtsRequestEvidenceScope,
  TtsTarget,
  TypedProviderSynthesisSettings,
} from '~/types'
import { hashCanonicalTtsValue } from './contract-identity'
import type { CurrentTtsRenderArtifacts } from './current-render-artifacts'

export const SCHEMA_VERSION = 'phase-0-v1'
export const PREPARATION_VERSION = 'generic-tts-v1'
export const EPOCH = new Date(0).toISOString()
export const CAPABILITY_CHECKED_AT = '2026-08-11T00:00:00.000Z'
export const LOCAL_ACTOR = { namespace: 'local-user' as const, actorId: 'current-cli-user' }
export const REQUESTED_OUTPUT = { codec: 'pcm_s16le', container: 'wav', sampleRate: 16000, channels: 1 }

export const CAPABILITY_SOURCE_REFS: Record<TtsTarget['service'], string[]> = {
  openai: ['https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create'],
  gemini: ['https://ai.google.dev/gemini-api/docs/speech-generation'],
  mistral: ['https://docs.mistral.ai/studio-api/audio/text_to_speech/speech'],
  deepgram: ['https://developers.deepgram.com/docs/tts-models'],
  grok: ['https://docs.x.ai/developers/model-capabilities/audio/text-to-speech'],
  groq: ['https://console.groq.com/docs/text-to-speech/orpheus'],
  elevenlabs: ['https://elevenlabs.io/docs/overview/capabilities/text-to-speech'],
  speechify: ['https://docs.sws.speechify.com/tts/text-to-speech/get-started/models'],
  hume: ['https://dev.hume.ai/reference/text-to-speech-tts/synthesize-json'],
  cartesia: ['https://docs.cartesia.ai/build-with-cartesia/tts-models/sonic-3-5'],
  minimax: ['https://platform.minimax.io/docs/api-reference/api-overview'],
  fish: ['https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech'],
  inworld: ['https://docs.inworld.ai/'],
  deepinfra: ['https://docs.deepinfra.com/apis/text-to-speech'],
  replicate: ['https://replicate.com/docs'],
  fal: [
    'https://fal.ai/models/fal-ai/bytedance/seed-speech/tts/v2',
    'https://fal.ai/models/fal-ai/maya',
    'https://fal.ai/models/async/tts-pro/v1.0',
  ],
}

export type WrittenJson<T> = { value: T, path: string, sha256: string }

export type AttemptTurn = {
  sourceIndex: number
  canonical: CanonicalDialogueTurn
  voice: { kind: 'provider-id' | 'reference-asset' | 'local-model-voice', value?: string | undefined, valueHash: string }
  binding: ResolvedVoiceBinding
  controls: TypedProviderSynthesisSettings
  effectiveControls: Readonly<Record<string, unknown>>
}

export type AttemptSlot = {
  batchId: string
  generationSlotId: string
  slotIndex: number
  turnIds: string[]
  providerText: string
  plannedCost: PlannedCost
  expectedRequestControlsHash: string
  expectedEndpointKind: string
  expectedSerializerVersion: string
  expectedVoiceField: string
  slotHash?: string | undefined
  timingSegmentIndex?: number | undefined
}

export type RecordedOutput = {
  path: string
  relativeToBatchResult: string
  sha256: string
  format: ObservedAudioFormat
  durationMs: number
  timing?: NormalizedTiming<'take-audio-ms'> | undefined
  providerGenerationId?: string | undefined
  warnings?: readonly string[] | undefined
}

export type RuntimeRequest = {
  slot: AttemptSlot
  invocationFile: WrittenJson<ProviderBatchInvocationPlan>
  request: ObservedProviderRequest
  retry?: ProviderRetryRecord | undefined
  terminal: 'completed' | 'provider-rejected' | 'ambiguous' | undefined
}

export type CapabilityFixture = {
  schemaVersion: 1
  records: AnyCapabilityRecord[]
  capabilityFixtureHash: string
  capabilityScopeHash: string
}

export type CurrentTtsRecoveredGenerationSlot = Readonly<{
  value: ProviderBatchResult
  path: string
  sha256: string
  attemptRoot?: string | undefined
  outputPaths: readonly string[]
  requiresMaterialization?: boolean | undefined
}>

export type CurrentTtsRenderAttempt = {
  requestEvidence: TtsRequestEvidenceScope
  preparedState: PipelineProviderState
  providerDispatchRequired: boolean
  plannedChunkCount: number
  executionSelection?: readonly {
    generationSlotId: string
    turnId: string
    providerSegmentIndex: number
  }[] | undefined
  finalizeSuccess: (audioPath: string, reportedOutputPath: string) => Promise<CurrentTtsRenderArtifacts>
  finalizeCheckpoint: () => Promise<{
    artifactDir: string
    operation: 'tts-synthesis' | 'comic-audio'
    targetKey: string
    transport: string
    renderIdentity: string
    strategy: ProviderRenderStrategy
    projection: CanonicalAudioProviderProjection
    completedGenerationSlotIds: string[]
    remainingGenerationSlotCount: number
  }>
  finalizeFailure: (error: unknown, phase?: SanitizedProviderError['phase']) => Promise<PipelineProviderState>
}

export type CreateCurrentTtsRenderAttemptOptions = {
  outputDir: string
  artifactRoot?: string | undefined
  target: TtsTarget
  sourceText: string
  ttsOptions: TtsOptions
  sourceIdentity?: GenericTtsSourceIdentity | undefined
  dialoguePlan?: GenericTtsDialoguePlan | undefined
  comicContext?: ComicTtsRenderContext | undefined
  /** Canonical provider-attempt count retained before preparing this render. */
  priorAttemptCount?: number | undefined
  /** Verified completed slots from an earlier attempt of this exact render. */
  recoveredSlots?: readonly CurrentTtsRecoveredGenerationSlot[] | undefined
  /** Planned provider spend already represented by retained canonical dispatch attempts. */
  retainedCumulativePlannedCost?: PlannedCost | undefined
  onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
  now?: (() => string) | undefined
}

export type PureCurrentTtsRenderPlanOptions = Omit<CreateCurrentTtsRenderAttemptOptions, 'outputDir' | 'artifactRoot' | 'onProviderState' | 'priorAttemptCount' | 'recoveredSlots' | 'retainedCumulativePlannedCost' | 'now'>

export type PureCurrentTtsReadinessPlan = Readonly<{
  operation: 'tts-synthesis' | 'comic-audio'
  transport: string
  targetKey: string
  capability: CapabilityFixture
  capabilityFixtureHash: string
  capabilityScopeHash: string
  branchCandidate: ProviderRenderBranchCandidate
  branchPlan: ProviderRenderBranchPlan
  renderPlan: ProviderRenderPlan
  renderPlanId: string
  renderIdentity: string
  strategy: ProviderRenderStrategy
  plannedCost: PlannedCost
}>

export type CurrentTtsCompletedRecovery = {
  kind: 'complete-render'
  preparedState: PipelineProviderState
  chunkCount: number
  reconciliationBlockers: readonly CurrentTtsReconciliationBlocker[]
  finalize: (workspaceDir: string, reportedOutputPath: string) => Promise<CurrentTtsRenderArtifacts>
}

export type CurrentTtsPartialRecovery = {
  kind: 'partial-slots'
  recoveredSlots: readonly CurrentTtsRecoveredGenerationSlot[]
  retainedCumulativePlannedCost: PlannedCost
  reconciliationBlockers: readonly CurrentTtsReconciliationBlocker[]
}

export type CurrentTtsSafeRedispatch = {
  kind: 'safe-redispatch'
  retainedCumulativePlannedCost: PlannedCost
  reconciliationBlockers: readonly CurrentTtsReconciliationBlocker[]
}

export type CurrentTtsReconciliationBlocker = Readonly<{
  generationSlotId: string
  state: RenderAdmissionJournalSnapshot['requests'][number]['transitions'][number]['state']
  attempt: number
  invocationId: string
  requestOrdinal: number
}>

export type CurrentTtsResumePricePlan = Readonly<{
  readiness: PureCurrentTtsReadinessPlan
  plannedCost: PlannedCost
  plannedSlotCount: number
  unresolvedSlotCount: number
  unresolvedCharacterCount: number
  recoveredSlotCount: number
  recoveryKind: 'none' | CurrentTtsCompletedRecovery['kind'] | CurrentTtsPartialRecovery['kind'] | CurrentTtsSafeRedispatch['kind']
  reconciliationBlockers: readonly CurrentTtsReconciliationBlocker[]
}>

export const withIdentity = <T extends Record<string, unknown>, K extends string>(value: T, field: K): T & Record<K, string> =>
  ({ ...value, [field]: hashCanonicalTtsValue(value) }) as T & Record<K, string>
