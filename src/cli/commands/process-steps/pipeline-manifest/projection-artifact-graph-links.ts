import type { ProjectionArtifactReference } from '~/types'
import { createGraphLinkContext } from './projection-artifact-link-context'
import {
  validateBranchPlanLinks,
  validateCapabilityFixtureLinks,
  validateReadinessResultLinks,
  validateRenderPlanLinks
} from './projection-artifact-plan-readiness-links'
import {
  validateProviderBatchResultLinks,
  validateProviderRenderResultLinks
} from './projection-artifact-render-batch-links'
import {
  validateAdmissionJournalLinks,
  validateAudioRunLinks,
  validateBatchResultProvenanceLinks,
  validateJournalRecordedBatchLinks,
  validateRenderResultClosedByLinks
} from './projection-artifact-admission-audio-links'

export const PROJECTION_ARTIFACT_GRAPH_LINK_PASSES = [
  validateCapabilityFixtureLinks,
  validateBranchPlanLinks,
  validateRenderPlanLinks,
  validateReadinessResultLinks,
  validateProviderBatchResultLinks,
  validateProviderRenderResultLinks,
  validateAdmissionJournalLinks,
  validateRenderResultClosedByLinks,
  validateBatchResultProvenanceLinks,
  validateJournalRecordedBatchLinks,
  validateAudioRunLinks
] as const

export const validateProjectionArtifactGraphLinks = (
  references: readonly ProjectionArtifactReference[],
  checked: ReadonlyMap<string, { sha256: string, json?: Record<string, unknown> | undefined }>
): boolean => {
  const context = createGraphLinkContext(references, checked)
  return PROJECTION_ARTIFACT_GRAPH_LINK_PASSES.every((pass) => pass(context))
}
