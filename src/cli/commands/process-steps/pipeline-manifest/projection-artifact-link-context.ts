import { isRecord } from '~/utils/rest-client'
import {
  projectionArtifactReferenceKey,
  resolveArtifactRelativePath
} from './projection-artifact-references'
import type { ProjectionArtifactReference } from './projection-artifact-references'

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

export const createGraphLinkContext = (
  references: readonly ProjectionArtifactReference[],
  checked: ReadonlyMap<string, { sha256: string, json?: Record<string, unknown> | undefined }>
): GraphLinkContext => {
  const referencesForKind = (kind: ProjectionArtifactReference['kind']) => references.filter((reference) => reference.kind === kind)
  const checkedReference = (reference: ProjectionArtifactReference) => checked.get(projectionArtifactReferenceKey(reference))
  const checkedProviderPath = (path: string) => checked.get(`provider-artifact\0${path}`)
  const jsonAt = (reference: ProjectionArtifactReference): Record<string, unknown> | undefined => checkedReference(reference)?.json
  const resolveFrom = (baseDir: string | undefined, path: unknown): string | undefined => resolveArtifactRelativePath(baseDir, path)

  const capabilityFixtures = new Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>()
  const branchPlansById = new Map<string, Record<string, unknown>>()
  const renderPlansByCandidate = new Map<string, Record<string, unknown>>()
  const renderPlansById = new Map<string, Record<string, unknown>>()
  const batchResults = new Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>()
  const admissionSnapshots = new Map<string, { reference: ProjectionArtifactReference, value: Record<string, unknown> }>()

  const batchOutput = (
    batchResultId: unknown,
    outputId: unknown
  ): { batch: { reference: ProjectionArtifactReference, value: Record<string, unknown> }, output: Record<string, unknown> } | undefined => {
    if (typeof batchResultId !== 'string' || typeof outputId !== 'string') return undefined
    const batch = batchResults.get(batchResultId)
    if (!batch || !Array.isArray(batch.value['outputs'])) return undefined
    const matches = batch.value['outputs'].filter((output) => isRecord(output) && output['outputId'] === outputId)
    return matches.length === 1 ? { batch, output: matches[0] as Record<string, unknown> } : undefined
  }

  return {
    references,
    checked,
    referencesForKind,
    checkedProviderPath,
    jsonAt,
    resolveFrom,
    capabilityFixtures,
    branchPlansById,
    renderPlansByCandidate,
    renderPlansById,
    batchResults,
    admissionSnapshots,
    batchOutput
  }
}
