export type CheckedArtifact = {
  sha256: string
  json?: Record<string, unknown> | undefined
}

export type ProjectionVerificationRoots = {
  root: string
  artifactRoot: string
  canonicalRoot: string
  canonicalArtifactRoot: string
}

export type ProjectionTraversalState = {
  checked: Map<string, CheckedArtifact>
  expanded: Set<string>
  visitedReferences: Set<string>
}
