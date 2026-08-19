export type StagedComicAudioArtifacts = {
  dialogueRef: { path: string, sha256: string }
  soundscapePlanRef: { path: string, sha256: string }
  snapshotRef: { path: string, sha256: string }
  baseArtifacts: Array<{ path: string, sha256: string }>
  audioMetadata: Record<string, unknown>
}
