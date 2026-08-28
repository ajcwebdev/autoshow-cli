export type ProjectionArtifactReference = {
  path: string
  sha256: string
  scope?: 'provider-artifact' | 'run-root' | undefined
  kind: 'audio' | 'strategy-text' | 'source-identity' | 'dialogue-plan' | 'capability-fixture' | 'branch-plan' | 'readiness-result' | 'render-plan' | 'admission-journal' | 'admission-evidence' | 'provider-render-result' | 'audio-run' | 'audio-mix-plan' | 'audio-transform-ledger' | 'final-timeline' | 'batch-invocation-plan' | 'provider-batch-result' | 'provider-timing-evidence' | 'cache-materialization-plan' | 'render-takes' | 'take-selection' | 'continuation-checkpoint' | 'consumed-selection-rebuild' | 'generic-json' | 'compact-render'
  expectedJsonFields?: Record<string, string | number> | undefined
  context?: {
    renderDir?: string | undefined
    attemptDir?: string | undefined
    batchResultDir?: string | undefined
    audioRunDir?: string | undefined
    branchCandidateId?: string | undefined
    accountObservationHashes?: string[] | undefined
    eventSequence?: number | undefined
    eventJournalSnapshotId?: string | undefined
    eventResultIdentity?: string | undefined
  } | undefined
}

export type ProjectionArtifactReferences = {
  files: ProjectionArtifactReference[]
  directories: string[]
}

export type ArtifactFileDescriptor = Readonly<{
  pathKey: string
  shaKey: string
  kind: ProjectionArtifactReference['kind']
  expectedJsonFields?: Record<string, string | number> | undefined
  baseDir?: string | undefined
  context?: ProjectionArtifactReference['context']
  scope?: ProjectionArtifactReference['scope']
}>

type ArchiveProjectionShape = {
  kind: 'archive'
  archive: Record<string, unknown>
}

type ActiveProjectionShape = {
  kind: 'active'
  branchHistory: unknown[]
  readinessAttempts: unknown[]
  renderHistory: unknown[]
}

export type ProjectionShape = ArchiveProjectionShape | ActiveProjectionShape

export type RenderCollectorContext = {
  targetKey: string
  render: Record<string, unknown>
  renderPlanId: string
  renderIdentity: string
  renderDir: string
  sink: import('~/cli/commands/process-steps/pipeline-manifest/projection-artifact-reference-sink').ArtifactReferenceSink
}

export type EventReferenceListDescriptor = Readonly<{
  key: 'outputRefs' | 'takeSelections' | 'continuationCheckpoints' | 'cacheEvidenceRefs' | 'reportedOutputRefs'
  kind: ProjectionArtifactReference['kind']
  renderRelative: boolean
  includeRenderContext: boolean
  scope?: ProjectionArtifactReference['scope']
}>

type NestedCollectorContext = {
  reference: ProjectionArtifactReference
  value: Record<string, unknown>
  renderDir: string | undefined
  nested: ProjectionArtifactReference[]
  add: (
    record: Record<string, unknown>,
    pathKey: string,
    shaKey: string,
    kind: ProjectionArtifactReference['kind'],
    baseDir: string | undefined,
    expectedJsonFields?: Record<string, string | number> | undefined,
    context?: ProjectionArtifactReference['context']
  ) => boolean
}

export type NestedCollector = (ctx: NestedCollectorContext) => boolean
