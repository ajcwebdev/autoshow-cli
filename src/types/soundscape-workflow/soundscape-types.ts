import type { AudioRun, ComicDialoguePlan, ComicSourceIdentity, NormalizedTiming, ObservedAudioFormat, StructuredScriptArtifactRef } from '~/types'

export type SoundscapeCueKind = 'vocal-reaction' | 'action-sfx'
export type SoundscapeBus = 'dialogue' | 'vocal-reaction' | 'action-sfx' | 'ambience'
export type SoundscapeTimingPolicy = 'strict' | 'proportional'

export type SoundscapeSourceSpan = {
  kind: 'sound-effect'
  start: number
  end: number
  indexUnit: 'unicode-scalar-value'
  text: string
}

export type SoundscapeAnchor =
  | { kind: 'scene-clock', positionMs: number }
  | { kind: 'source-segment-edge', sourceSegmentId: string, edge: 'start' | 'end', offsetMs: number }
  | { kind: 'source-text-offset', sourceSegmentId: string, textOffset: number, indexUnit: 'unicode-scalar-value', offsetMs: number }

export type AuthoredSoundscapeCue = {
  cueId: string
  kind: SoundscapeCueKind
  prompt: string
  required: boolean
  anchor: SoundscapeAnchor
  sourceSpan: SoundscapeSourceSpan
  durationSeconds?: number | undefined
  gainDb?: number | undefined
  pan?: number | undefined
}

export type AuthoredAmbientBed = {
  cueId: string
  kind: 'ambience'
  prompt: string
  required: boolean
  range: { kind: 'full-scene' } | { kind: 'anchors', start: SoundscapeAnchor, end: SoundscapeAnchor }
  sourceSpan: SoundscapeSourceSpan
  durationSeconds?: number | undefined
  gainDb?: number | undefined
  pan?: number | undefined
}

export type StructuredSoundscape = {
  cues: AuthoredSoundscapeCue[]
  ambientBeds: AuthoredAmbientBed[]
}

export type SoundEffectSynthesisTask = {
  taskId: string
  generationIdentity: string
  cueId: string
  kind: SoundscapeCueKind | 'ambience'
  prompt: string
  required: boolean
  durationSeconds?: number | undefined
  loop: boolean
}

export type SoundscapeMixProfile = {
  schemaVersion: 1
  profileKey: string
  busGainDb: Record<SoundscapeBus, number>
  loudness: { mode: 'none' | 'ebu-r128', integratedLufs?: number | undefined }
  ambienceDucking: {
    sidechainBuses: ['dialogue', 'vocal-reaction']
    depthDb: number
    detectorWindowMs: number
    thresholdDb: number
    attackMs: number
    releaseMs: number
  }
  bedLoopCrossfadeMs: number
  panLaw: 'constant-power'
  defaultPan: number
  fadeInMs: number
  fadeOutMs: number
  limiter: { ceiling: number, truePeakDb: number }
  sampleRate: number
  channels: 1 | 2
  codec: 'pcm_s16le' | 'pcm_s24le'
  container: 'wav'
}

export type SoundscapePlan = {
  schemaVersion: 1
  soundscapePlanId: string
  sceneRunIdentity: string
  sourceIdentity: ComicSourceIdentity
  structuredScript: StructuredScriptArtifactRef
  structuredScriptHash: string
  dialoguePlanId: ComicDialoguePlan['dialoguePlanId']
  timingPolicy: SoundscapeTimingPolicy
  cues: AuthoredSoundscapeCue[]
  ambientBeds: AuthoredAmbientBed[]
  synthesisTasks: SoundEffectSynthesisTask[]
  mixProfile: SoundscapeMixProfile
  mixProfileHash: string
  mixIdentity: string
  createdAt: string
}

export type ResolvedSoundscapeAnchorResolution = {
  anchorRole: 'point' | 'range-start' | 'range-end'
  policy: SoundscapeTimingPolicy
  algorithm: 'scene-clock-v1' | 'source-segment-edge-v1' | 'prepared-provider-timing-v1' | 'canonical-offset-linear-v1'
  positionMs: number
  inputEvidenceHash: string
  errorBoundMs: number
}

export type SoundEffectProvider = 'elevenlabs' | 'replicate'

export type SoundEffectCapabilityFixture = {
  schemaVersion: 1
  provider: SoundEffectProvider
  model: string
  pinnedVersion?: string | undefined
  transport: 'hosted-api'
  endpoint: string
  serializerVersion: string
  licenseProvenance?: string | undefined
  permittedUse?: 'noncommercial' | 'commercial' | undefined
  checkedAt: string
  sourceRefs: string[]
  constraints: {
    promptMaxScalars: number
    durationSeconds: { min: number, max: number, default?: number | undefined, optional?: boolean | undefined }
    promptInfluence?: { min: number, max: number, default: number } | undefined
    loopModels?: string[] | undefined
    outputFormats: string[]
  }
  pricing: {
    currency: 'USD'
    specifiedDurationPerMinute: number
    automaticDurationPerRequest: number | null
  }
  capabilityFixtureHash: string
}

export type SoundEffectTarget = {
  provider: SoundEffectProvider
  model: string
  transport: 'hosted-api'
  targetKey: string
  capabilityFixture: SoundEffectCapabilityFixture
  outputFormat: string
  promptInfluence: number
}

export type SoundEffectRenderTask = SoundEffectSynthesisTask & {
  requestIdentity: string
  outputFormat: string
  promptInfluence: number
}

export type SoundEffectRenderPlan = {
  schemaVersion: 1
  renderPlanId: string
  soundscapePlanId: string
  target: SoundEffectTarget
  tasks: SoundEffectRenderTask[]
  plannedCost: { amount: number | null, currency: 'USD', basis: string }
  createdAt: string
}

export type SoundEffectRequestEvidence = {
  schemaVersion: 1
  requestEvidenceId: string
  requestIdentity: string
  requestOrdinal: number
  endpoint: string
  serializerVersion: string
  requestBodyHash: string
  queryHash: string
  providerRequestId?: string | undefined
  observedContentType?: string | undefined
  observedCharacterCost?: number | undefined
  capturedAt: string
}

export type SoundEffectGenerationResponse = {
  bytes: Uint8Array
  contentType: string
  providerRequestId?: string | undefined
  observedCharacterCost?: number | undefined
  requestEvidence: SoundEffectRequestEvidence
}

export type SoundEffectRenderResultEntry = {
  cueId: string
  taskId: string
  generationIdentity: string
  requestIdentity: string
  status: 'succeeded' | 'omitted'
  source: 'provider-dispatch' | 'cache-materialization' | 'resume'
  audio?: { path: string, sha256: string, format: ObservedAudioFormat, durationMs: number } | undefined
  requestEvidence?: SoundEffectRequestEvidence | undefined
  omissionReason?: string | undefined
}

export type SoundEffectRenderResult = {
  schemaVersion: 1
  resultId: string
  renderPlanId: string
  soundscapePlanId: string
  targetKey: string
  status: 'succeeded' | 'failed' | 'canceled'
  entries: SoundEffectRenderResultEntry[]
  createdAt: string
}

export type ResolvedSoundscapeTimelineEntry = {
  cueId: string
  bus: Exclude<SoundscapeBus, 'dialogue'>
  required: boolean
  status: 'placed' | 'omitted'
  sourceRangeMs?: { start: number, end: number } | undefined
  finalRangeMs?: { start: number, end: number } | undefined
  sourceAudioSha256?: string | undefined
  anchorResolutions?: ResolvedSoundscapeAnchorResolution[] | undefined
  loopIterations?: number | undefined
  omissionReason?: string | undefined
}

export type ResolvedSoundscapeTimeline = {
  schemaVersion: 1
  timelineId: string
  soundscapePlanId: string
  dialogueAudioRunId: string
  dialogueTiming: NormalizedTiming<'final-audio-ms'>
  preRollMs: number
  durationMs: number
  entries: ResolvedSoundscapeTimelineEntry[]
}

export type SoundscapeTransform = {
  transformId: string
  kind: 'normalize' | 'place' | 'loop' | 'fade' | 'gain' | 'pan' | 'duck' | 'sum' | 'limit' | 'master'
  bus?: SoundscapeBus | undefined
  cueId?: string | undefined
  parametersHash: string
  finalRangeMs?: { start: number, end: number } | undefined
}

export type SoundscapeStemRef = {
  bus: SoundscapeBus
  path: string
  sha256: string
  format: ObservedAudioFormat
  durationMs: number
}

export type SoundscapeAudioRun = {
  schemaVersion: 1
  audioRunId: string
  dialogueAudioRun: { audioRunId: AudioRun['audioRunId'], path: string, sha256: string }
  soundscapePlan: { soundscapePlanId: string, path: string, sha256: string }
  soundEffectRenderPlan?: { renderPlanId: string, path: string, sha256: string } | undefined
  soundEffectRenderResult?: { resultId: string, path: string, sha256: string } | undefined
  resolvedTimeline: { timelineId: string, path: string, sha256: string }
  mixProfileHash: string
  mixIdentity: string
  transformLedger: { path: string, sha256: string }
  transforms: SoundscapeTransform[]
  stems: SoundscapeStemRef[]
  master: { path: string, sha256: string, format: ObservedAudioFormat, durationMs: number }
  createdAt: string
}
