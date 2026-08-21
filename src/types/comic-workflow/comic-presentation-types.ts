import type {
  AuthoredAmbientBed,
  AuthoredSoundscapeCue,
  ComicDialoguePlan,
  ComicSourceIdentity,
  ComicStageArtifactRef,
  ObservedAudioFormat,
  SoundscapeMixProfile,
} from '~/types'

type ComicPresentationArtifactRef = ComicStageArtifactRef

export type ComicPresentationPanelInput = {
  panelNumber: number
  path: string
  sha256: string
  width: number
  height: number
}

export type ComicPresentationDialogueBinding = {
  turnId: string
  sourceSegmentId: string
  panelNumber: number
  subjectKey: string
  speakerLabel: string
  canonicalText: string
  evidence:
    | {
        kind: 'source-segment-id'
        sourceSegmentId: string
        panelSourceSegmentIds: string[]
        speechOrdinal: number
        textMatch?: 'exact' | 'exact-after-source-cue-elision' | undefined
        panelText?: string | undefined
      }
    | {
        kind: 'exact-content-ordinal'
        speaker: string
        text: string
        occurrence: number
        speechOrdinal: number
        textMatch?: 'exact' | 'exact-after-source-cue-elision' | undefined
      }
}

export type ComicPresentationSoundBinding = {
  cueId: string
  panelNumber: number
  kind: AuthoredSoundscapeCue['kind']
  prompt: string
  sourceSpan: AuthoredSoundscapeCue['sourceSpan']
  sourceAudio: ComicPresentationArtifactRef & { durationMs: number }
  originalRangeMs: { start: number, end: number }
  gainDb: number
  pan: number
  evidence:
    | { kind: 'inline-source-segment', sourceSegmentId: string, turnIds: string[] }
    | { kind: 'preceding-action-segment', sourceSegmentId: string, sourceSegmentEnd: number, equivalentSourceSegmentIds?: string[] | undefined }
}

export type ComicPresentationAmbienceInput = {
  cueId: string
  prompt: string
  sourceSpan: AuthoredAmbientBed['sourceSpan']
  sourceAudio: ComicPresentationArtifactRef & { durationMs: number }
  gainDb: number
  pan: number
}

export type ComicPresentationPlan = {
  schemaVersion: 1
  presentationId: string
  sceneRunIdentity: string
  sourceIdentity: ComicSourceIdentity
  createdAt: string
  options: { untimedPanelMs: number, fps: number }
  inputs: {
    reviewedScene: ComicPresentationArtifactRef
    structuredScript: ComicPresentationArtifactRef
    dialoguePlan: ComicPresentationArtifactRef & { dialoguePlanId: ComicDialoguePlan['dialoguePlanId'] }
    audioTarget: { kind: 'dialogue' | 'soundscape', targetKey: string, provider: string, model: string }
    dialogueAudioRun: ComicPresentationArtifactRef & { audioRunId: string }
    dialogueTimeline: ComicPresentationArtifactRef & { timelineId: string }
    dialogueAudio: ComicPresentationArtifactRef & { format: ObservedAudioFormat, durationMs: number }
    soundscapeAudioRun?: ComicPresentationArtifactRef & { audioRunId: string } | undefined
    soundscapePlan?: ComicPresentationArtifactRef & { soundscapePlanId: string } | undefined
    soundEffectRenderResult?: ComicPresentationArtifactRef & { resultId: string } | undefined
    soundscapeTimeline?: ComicPresentationArtifactRef & { timelineId: string, preRollMs: number } | undefined
    panels: ComicPresentationPanelInput[]
  }
  dialogueBindings: ComicPresentationDialogueBinding[]
  soundBindings: ComicPresentationSoundBinding[]
  ambience: ComicPresentationAmbienceInput[]
  soundscapeMixProfile?: SoundscapeMixProfile | undefined
}

export type ComicPresentationTimelineEvent = {
  eventId: string
  kind: 'dialogue' | 'vocal-reaction' | 'action-sfx'
  panelNumber: number
  sourceIds: string[]
  sourceRangeMs: { start: number, end: number }
  originalRangeMs: { start: number, end: number }
  presentationRangeMs: { start: number, end: number }
}

export type ResolvedPanelTimeline = {
  schemaVersion: 1
  timelineId: string
  presentationId: string
  durationMs: number
  panels: Array<{
    panelNumber: number
    image: ComicPresentationPanelInput
    startMs: number
    endMs: number
    durationMs: number
    timing: 'assigned-audio' | 'untimed-hold'
    eventIds: string[]
  }>
  events: ComicPresentationTimelineEvent[]
}

export type ComicPresentationAudioTransform = {
  transformId: string
  kind: 'dialogue-range' | 'sound-effect-placement' | 'ambience-loop' | 'digital-silence' | 'mix'
  sourceRef?: ComicPresentationArtifactRef | undefined
  sourceIds: string[]
  sourceRangeMs?: { start: number, end: number } | undefined
  finalRangeMs: { start: number, end: number }
  parametersHash: string
}

export type ComicPresentationEncoderProfile = {
  schemaVersion: 1
  videoCodec: 'h264'
  videoEncoder: 'libx264' | 'h264_videotoolbox' | 'h264_nvenc' | 'h264_amf'
  pixelFormat: 'yuv420p'
  fps: number
  stillImageTuning: 'libx264-stillimage' | 'static-source'
  audioCodec: 'aac'
  audioBitrate: '192k'
  fastStart: true
  transitions: 'hard-cuts'
  width: number
  height: number
}

export type ComicPresentationRun = {
  schemaVersion: 1
  presentationRunId: string
  presentationId: string
  plan: ComicPresentationArtifactRef
  resolvedTimeline: ComicPresentationArtifactRef & { timelineId: string }
  audioTransforms: ComicPresentationAudioTransform[]
  encoderProfile: ComicPresentationEncoderProfile
  commands: Array<{ tool: 'ffmpeg', args: string[] }>
  outputs: {
    wav: ComicPresentationArtifactRef & { format: ObservedAudioFormat, durationMs: number }
    mp4: ComicPresentationArtifactRef & { durationMs: number }
  }
  createdAt: string
}

export type CompactPresentation = {
  schemaVersion: 1
  presentationId: string
  plan: ComicPresentationPlan
  timeline: ResolvedPanelTimeline
  encoderProfile: ComicPresentationEncoderProfile
  audioTransforms: ComicPresentationAudioTransform[]
  commands: Array<{ tool: 'ffmpeg', args: string[] }>
  outputs: {
    wav: ComicPresentationArtifactRef & { format: ObservedAudioFormat, durationMs: number }
    mp4: ComicPresentationArtifactRef & { durationMs: number }
  }
  createdAt: string
}

export type ComicPresentationMetadata = {
  selectedPresentationId?: string | undefined
  planRef?: ComicPresentationArtifactRef | undefined
  resolvedTimelineRef?: ComicPresentationArtifactRef | undefined
  runRef?: ComicPresentationArtifactRef | undefined
  finalOutputRefs?: ComicPresentationArtifactRef[] | undefined
}
