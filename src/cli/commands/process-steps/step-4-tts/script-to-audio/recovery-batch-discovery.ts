import { readdir } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import type {
  CanonicalAudioProviderProjection,
  ProviderBatchResult,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTtsJson } from './contract-identity'
import { validateProviderBatchResult } from './contract-validation'
import { contained } from './attempt-io'
import { readContainedArtifactFile } from './safe-artifact-store'
import { buildPureCurrentTtsRenderPlan } from './attempt-planning'
import {
  resolveRetainedPath,
  type RetainedJournalEvidence,
} from './recovery-evidence'

export type RetainedBatchCandidate = {
  batchId: string
  generationSlotId: string
  batchResultId: string
  path: string
  sha256: string
  attemptRoot: string
}

const addBatchCandidate = (
  candidates: Map<string, RetainedBatchCandidate>,
  candidate: RetainedBatchCandidate
): void => {
  const existing = candidates.get(candidate.batchResultId)
  if (existing && canonicalTtsJson(existing) !== canonicalTtsJson(candidate)) {
    throw CLIUsageError('Stored TTS batch-result identity has conflicting retained artifact bindings.')
  }
  candidates.set(candidate.batchResultId, candidate)
}

const discoverJournalBatchCandidates = (
  candidates: Map<string, RetainedBatchCandidate>,
  journalEvidenceById: Map<string, RetainedJournalEvidence>
): void => {
  for (const evidence of journalEvidenceById.values()) {
    for (const reference of evidence.value.recordedBatchResults) {
      addBatchCandidate(candidates, {
        batchId: reference.batchId,
        generationSlotId: reference.generationSlotId,
        batchResultId: reference.batchResultId,
        path: resolveRetainedPath(evidence.attemptRoot, reference.batchResultRef, 'Stored provider batch result'),
        sha256: reference.batchResultSha256,
        attemptRoot: evidence.attemptRoot
      })
    }
  }
}

const discoverProjectionBatchCandidates = (
  candidates: Map<string, RetainedBatchCandidate>,
  renderRoot: string,
  retainedRender: CanonicalAudioProviderProjection['renderHistory'][number]
): void => {
  for (const event of retainedRender.events) {
    for (const batch of event.batchProgress ?? []) {
      for (const slot of batch.generationSlots) {
        if (slot.source !== 'provider-dispatch' || !slot.batchResult) continue
        const path = resolveRetainedPath(renderRoot, slot.batchResult.path, 'Stored provider batch result')
        const relativeResult = relative(renderRoot, path).split(sep)
        const batchResultsIndex = relativeResult.lastIndexOf('batch-results')
        if (batchResultsIndex < 1) throw CLIUsageError('Stored provider batch result is outside an immutable provider attempt.')
        addBatchCandidate(candidates, {
          batchId: batch.batchId,
          generationSlotId: slot.generationSlotId,
          batchResultId: slot.batchResult.batchResultId,
          path,
          sha256: slot.batchResult.sha256,
          attemptRoot: resolve(renderRoot, ...relativeResult.slice(0, batchResultsIndex))
        })
      }
    }
  }
}

const discoverOrphanBatchCandidates = async (
  options: { rootDir: string },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  candidates: Map<string, RetainedBatchCandidate>,
  attemptRoots: Set<string>
): Promise<void> => {
  for (const attemptRoot of attemptRoots) {
    const orphanResultNames = (await readdir(attemptRoot, { recursive: true }))
      .map((name) => name.split(sep).join('/'))
      .filter((name) => /^batch-results\/[^/]+\/[^/]+\/provider-batch-result\.json$/.test(name))
      .sort()
    for (const name of orphanResultNames) {
      const path = resolve(attemptRoot, name)
      const retained = await readContainedArtifactFile(options.rootDir, contained(options.rootDir, path))
      let value: ProviderBatchResult
      try {
        value = JSON.parse(retained.bytes.toString('utf8')) as ProviderBatchResult
        validateProviderBatchResult(value)
      } catch {
        throw CLIUsageError('Stored TTS attempt contains an invalid orphan provider batch result; reconciliation is required.')
      }
      if (value.provenance !== 'provider-dispatch') continue
      if (value.renderIdentity !== pure.renderIdentity || value.renderPlanId !== pure.renderPlanId) {
        throw CLIUsageError('Stored TTS attempt contains a cross-render orphan provider batch result; reconciliation is required.')
      }
      addBatchCandidate(candidates, {
        batchId: value.batchId,
        generationSlotId: value.generationSlotId,
        batchResultId: value.batchResultId,
        path,
        sha256: retained.sha256,
        attemptRoot
      })
    }
  }
}

export const discoverBatchCandidates = async (
  options: { rootDir: string },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  renderRoot: string,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  retainedRender: CanonicalAudioProviderProjection['renderHistory'][number]
): Promise<Map<string, RetainedBatchCandidate>> => {
  const candidates = new Map<string, RetainedBatchCandidate>()
  discoverJournalBatchCandidates(candidates, journalEvidenceById)
  discoverProjectionBatchCandidates(candidates, renderRoot, retainedRender)
  await discoverOrphanBatchCandidates(
    options,
    pure,
    candidates,
    new Set([...journalEvidenceById.values()].map((evidence) => evidence.attemptRoot))
  )
  return candidates
}
