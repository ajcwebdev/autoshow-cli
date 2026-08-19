export type ComicArtifactLineageError = {
  code: 'manifest-unreadable' | 'checksum-mismatch' | 'missing-artifact' | 'invalid-json' | 'invalid-identity' | 'missing-binding' | 'missing-presentation' | 'transform-ledger-mismatch'
  message: string
  path?: string | undefined
  targetKey?: string | undefined
}

export type ComicArtifactLineageAudit = {
  sceneRunDir: string
  status: 'passed' | 'failed'
  verifiedRefCount: number
  selectedDialogueTargets: string[]
  selectedSoundscapeTargets: string[]
  presentationTargets: string[]
  errors: ComicArtifactLineageError[]
}

export type ArtifactRef = { path: string, sha256: string }

export type LineageVerifier = {
  verifyRef: (ref: ArtifactRef, label: string, targetKey?: string) => Promise<Buffer | undefined>
  verifyJson: <T>(ref: ArtifactRef, label: string, targetKey?: string) => Promise<T | undefined>
  fail: (error: ComicArtifactLineageError) => void
  verified: Set<string>
}
