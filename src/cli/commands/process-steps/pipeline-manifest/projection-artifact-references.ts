import type {
  NestedCollector,
  ProjectionArtifactReference,
  ProjectionArtifactReferences,
  ProjectionShape
} from '~/types'
import { isRecord } from '~/utils/rest-client'
import { ADMISSION_NESTED_COLLECTORS } from './projection-artifact-reference-nested-admission'
import { AUDIO_NESTED_COLLECTORS } from './projection-artifact-reference-nested-audio'
import { RENDER_NESTED_COLLECTORS } from './projection-artifact-reference-nested-render'
import { collectRenderHistory } from './projection-artifact-reference-render'
import {
  ArtifactReferenceSink,
  createNestedArtifactReference
} from './projection-artifact-reference-sink'

export {
  ArtifactReferenceSink,
  projectionArtifactReferenceKey,
  resolveArtifactRelativePath
} from './projection-artifact-reference-sink'

const selectProjectionShape = (projection: Record<string, unknown>): ProjectionShape | undefined => {
  const archive = projection['archive']
  if (isRecord(archive) && isRecord(projection['selectedSuccess']) && projection['activeWork'] === undefined) {
    return { kind: 'archive', archive }
  }
  const branchHistory = projection['branchHistory']
  const readinessAttempts = projection['readinessAttempts']
  const renderHistory = projection['renderHistory']
  if (!Array.isArray(branchHistory) || !Array.isArray(readinessAttempts) || !Array.isArray(renderHistory)) return undefined
  return { kind: 'active', branchHistory, readinessAttempts, renderHistory }
}

const collectArchiveProjection = (
  archive: Record<string, unknown>,
  targetKey: string,
  sink: ArtifactReferenceSink
): boolean => {
  const renderRef = archive['renderRef']
  const timelineRef = archive['timelineRef']
  const finalRef = archive['finalRef']
  if (!isRecord(renderRef) || !isRecord(timelineRef) || !isRecord(finalRef)) return false
  return sink.addFile(renderRef, {
    pathKey: 'path',
    shaKey: 'sha256',
    kind: 'compact-render',
    expectedJsonFields: { targetKey },
    scope: 'run-root'
  })
    && sink.addFile(timelineRef, { pathKey: 'path', shaKey: 'sha256', kind: 'final-timeline', scope: 'run-root' })
    && sink.addFile(finalRef, { pathKey: 'path', shaKey: 'sha256', kind: 'audio', scope: 'run-root' })
}

const collectBranchHistory = (
  branches: readonly unknown[],
  targetKey: string,
  sink: ArtifactReferenceSink
): boolean => branches.every((branch) => isRecord(branch)
  && typeof branch['branchPlanId'] === 'string'
  && sink.addFile(branch, {
    pathKey: 'branchPlanRef',
    shaKey: 'branchPlanSha256',
    kind: 'branch-plan',
    expectedJsonFields: { branchPlanId: branch['branchPlanId'], targetKey }
  }))

const collectReadinessHistory = (
  attempts: readonly unknown[],
  targetKey: string,
  sink: ArtifactReferenceSink
): boolean => attempts.every((readiness) => isRecord(readiness) && sink.addFile(readiness, {
  pathKey: 'readinessResultRef',
  shaKey: 'readinessResultHash',
  kind: 'readiness-result',
  expectedJsonFields: { branchPlanId: readiness['branchPlanId'] as string, targetKey }
}))

const selectedReportedOutputAuthority = (projection: Record<string, unknown>): { renderIdentity: string, eventSequence: number } | undefined => {
  const selected = projection['selectedSuccess']
  if (!isRecord(selected) || typeof selected['renderIdentity'] !== 'string' || !Number.isInteger(selected['eventSequence'])) return undefined
  const active = projection['activeWork']
  if (
    isRecord(active)
    && active['kind'] === 'render'
    && (active['renderIdentity'] !== selected['renderIdentity'] || active['eventSequence'] !== selected['eventSequence'])
  ) return undefined
  return { renderIdentity: selected['renderIdentity'], eventSequence: selected['eventSequence'] as number }
}

export const collectProjectionArtifactReferences = (
  projection: Record<string, unknown>,
  targetKey: string
): ProjectionArtifactReferences | undefined => {
  const shape = selectProjectionShape(projection)
  if (!shape) return undefined
  const sink = new ArtifactReferenceSink()
  if (shape.kind === 'archive') return collectArchiveProjection(shape.archive, targetKey, sink) ? sink.result() : undefined
  if (!collectBranchHistory(shape.branchHistory, targetKey, sink)) return undefined
  if (!collectReadinessHistory(shape.readinessAttempts, targetKey, sink)) return undefined
  if (!collectRenderHistory(shape.renderHistory, targetKey, sink, selectedReportedOutputAuthority(projection))) return undefined
  return sink.result()
}

const NESTED_COLLECTORS: Partial<Record<ProjectionArtifactReference['kind'], NestedCollector>> = {
  ...RENDER_NESTED_COLLECTORS,
  ...ADMISSION_NESTED_COLLECTORS,
  ...AUDIO_NESTED_COLLECTORS
}

export const collectNestedProjectionArtifactReferences = (
  reference: ProjectionArtifactReference,
  value: Record<string, unknown>
): ProjectionArtifactReference[] | undefined => {
  const nested: ProjectionArtifactReference[] = []
  const add = (
    record: Record<string, unknown>,
    pathKey: string,
    shaKey: string,
    kind: ProjectionArtifactReference['kind'],
    baseDir: string | undefined,
    expectedJsonFields?: Record<string, string | number> | undefined,
    context?: ProjectionArtifactReference['context']
  ): boolean => {
    const child = createNestedArtifactReference(record, pathKey, shaKey, kind, baseDir, expectedJsonFields, context)
    if (!child) return false
    nested.push(child)
    return true
  }

  const collector = NESTED_COLLECTORS[reference.kind]
  if (!collector) return nested
  return collector({ reference, value, renderDir: reference.context?.renderDir, nested, add }) ? nested : undefined
}
