import type {
  CanonicalDialoguePlanNode,
  PipelineItemStatus,
  PipelineProviderStatus,
  ProtectedAssetRef,
  ProviderVoiceRef,
  SanitizedProviderVoiceMetadata,
  TtsProvider,
  TypedProviderSynthesisSettings,
  ComicPresentationMetadata,
} from '~/types'

export type ComicSourceIdentity = {
  schemaVersion: 1
  canonicalPath: string
  scriptSlug: string
  contentSha256: string
  identityHash: string
}

export type StructuredScriptArtifactRef = {
  path: 'metadata/structured-script.json'
  artifactSchemaVersion: 5
  sha256: string
}

export type ComicDialoguePlan = {
  schemaVersion: 2
  dialoguePlanId: string
  sceneRunIdentity: string
  sourceIdentity: ComicSourceIdentity
  structuredScript: StructuredScriptArtifactRef
  createdAt: string
  pacing: {
    profile: 'none' | 'loose-comedy'
    interTurnMs: number
  }
  nodes: CanonicalDialoguePlanNode[]
}

export type ApprovedVoiceSnapshotEntry = {
  entryId: string
  registrationId: string
  generationId: string
  subjectKey: string
  profileKey: string
  provider: TtsProvider
  providerVoice: ProviderVoiceRef
  providerModel: string
  creationModel?: string | undefined
  settingsSchema: string
  synthesisSettings: TypedProviderSynthesisSettings
  sanitizedProviderMetadata: SanitizedProviderVoiceMetadata
  briefHash: string
  auditionManifestHash: string
  approvedAudition: ProtectedAssetRef
  referenceAsset?: ProtectedAssetRef | undefined
  provenanceRef: string
  consentRecordRef?: string | undefined
  capabilityFixtureHash: string
  registrationStateAtSnapshot: 'approved-ready'
  providerRevision?: string | undefined
  externallyMutable: boolean
  registrationApprovedAt: string
  entryHash: string
}

export type VoiceReferenceManifest = {
  schemaVersion: 1
  snapshotId: string
  sceneRunIdentity: string
  dialoguePlanId: string
  catalogHash: string
  briefSetHash: string
  createdAt: string
  entries: ApprovedVoiceSnapshotEntry[]
}

export type VoiceReferenceSnapshotIndex = {
  schemaVersion: 1
  entries: Array<{
    sceneRunIdentity: string
    dialoguePlanId: string
    snapshotId: string
    renderIdentities: string[]
    createdAt: string
  }>
}

export type ComicStageArtifactRef = { path: string, sha256: string }

export type ComicStageRecord =
  | {
      requirement: 'not-requested'
      status: 'skipped'
      execution: { kind: 'none', reason: 'not-requested' }
      targetKeys: []
      artifactRefs: []
    }
  | {
      requirement: 'required' | 'optional'
      status: PipelineItemStatus
      execution: { kind: 'local', state: PipelineProviderStatus, policyReason?: string | undefined }
      targetKeys: []
      artifactRefs: ComicStageArtifactRef[]
    }
  | {
      requirement: 'required' | 'optional'
      status: PipelineItemStatus
      execution: { kind: 'provider-targets' }
      targetKeys: [string, ...string[]]
      artifactRefs: ComicStageArtifactRef[]
    }

export type CanonicalComicItemMetadata = {
  schemaVersion: 1
  stages: {
    structure: ComicStageRecord
    image: ComicStageRecord
    audio: ComicStageRecord
    presentation: ComicStageRecord
  }
  audio: {
    sceneRunIdentity?: string | undefined
    structuredScript?: StructuredScriptArtifactRef | undefined
    dialoguePlanId?: string | undefined
    dialoguePlanRef?: ComicStageArtifactRef | undefined
    snapshotId?: string | undefined
    snapshotRef?: ComicStageArtifactRef | undefined
    selectedAudioRuns?: Array<{
      targetKey: string
      renderIdentity: string
      audioRunId: string
      audioRunRef: string
      audioRunSha256: string
    }> | undefined
    publishedAudioRunId?: string | undefined
    mixPlanRef?: ComicStageArtifactRef | undefined
    finalTimelineRef?: ComicStageArtifactRef | undefined
    finalOutputRefs?: ComicStageArtifactRef[] | undefined
    soundscapePlanId?: string | undefined
    soundscapePlanRef?: ComicStageArtifactRef | undefined
    soundEffectRenderPlanRef?: ComicStageArtifactRef | undefined
    soundEffectRenderResultRef?: ComicStageArtifactRef | undefined
    selectedSoundscapeRuns?: Array<{
      targetKey: string
      dialogueAudioRunId: string
      soundscapeAudioRunId: string
      audioRunRef: string
      audioRunSha256: string
      masterRef: ComicStageArtifactRef
    }> | undefined
  }
  presentation: ComicPresentationMetadata
}

export type ComicAudioMode = 'auto' | 'native' | 'segmented'
export type ComicAudioDeliveryPolicy = 'strict' | 'best-effort'
export type ComicAudioPacingProfile = 'none' | 'loose-comedy'
export type ComicAudioSoundscapeTimingPolicy = 'strict' | 'proportional'

export type ComicAudioRolePolicy = {
  speakerLabel: string
  subjectKey: string
}

export type ComicGenerateAudioOptions = {
  scriptPath: string
  sceneSlug: string
  outputDir?: string | undefined
  profileKey: string
  mode: ComicAudioMode
  deliveryPolicy: ComicAudioDeliveryPolicy
  pacingProfile: ComicAudioPacingProfile
  soundscapeTimingPolicy: ComicAudioSoundscapeTimingPolicy
  rolePolicies: ComicAudioRolePolicy[]
  sampleRate: number
  channels: 1 | 2
  codec: 'pcm_s16le' | 'pcm_s24le'
  price: boolean
  sfxProvider?: string | undefined
  sfxLicenseUse?: string | undefined
  sfxConcurrency?: number | undefined
}
