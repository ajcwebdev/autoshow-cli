import type { ProjectionArtifactReference } from '~/types'

export type GraphLinkContext = {
  references: readonly ProjectionArtifactReference[]
  checked: ReadonlyMap<string, { sha256: string, json?: Record<string, unknown> | undefined }>
  referencesForKind: (kind: ProjectionArtifactReference['kind']) => ProjectionArtifactReference[]
  checkedProviderPath: (path: string) => { sha256: string, json?: Record<string, unknown> | undefined } | undefined
  jsonAt: (reference: ProjectionArtifactReference) => Record<string, unknown> | undefined
  resolveFrom: (baseDir: string | undefined, path: unknown) => string | undefined
  capabilityFixtures: Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>
  branchPlansById: Map<string, Record<string, unknown>>
  renderPlansByCandidate: Map<string, Record<string, unknown>>
  renderPlansById: Map<string, Record<string, unknown>>
  batchResults: Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>
  admissionSnapshots: Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>
  batchOutput: (batchResultId: unknown, outputId: unknown) => { batch: { reference: ProjectionArtifactReference, value: Record<string, unknown> }, output: Record<string, unknown> } | undefined
}
