import type { RetainedJournalEvidence } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { validateRenderAdmissionJournalSnapshot } from './contract-validation'

export const reconcileJournalChain = (
  frontier: RetainedJournalEvidence,
  declared: readonly RetainedJournalEvidence[],
  candidates: readonly RetainedJournalEvidence[]
): { frontier: RetainedJournalEvidence, descendantSnapshotIds: string[] } => {
  const remaining = new Set(candidates)
  const bySnapshot = new Map(declared.map(entry => [entry.value.snapshotId, entry]))
  for (const candidate of candidates) {
    if (bySnapshot.has(candidate.value.snapshotId)) throw UsageError('Stored TTS attempt contains duplicate orphan journal evidence; reconciliation is required.')
    bySnapshot.set(candidate.value.snapshotId, candidate)
  }
  let ancestor = frontier
  const visited = new Set<string>()
  for (let step = 0; step <= bySnapshot.size && ancestor.value.previousSnapshotId; step++) {
    if (visited.has(ancestor.value.snapshotId)) throw UsageError('Stored TTS attempt contains a cyclic journal chain; reconciliation is required.')
    visited.add(ancestor.value.snapshotId)
    const previous = bySnapshot.get(ancestor.value.previousSnapshotId)
    if (!previous) break
    validateRenderAdmissionJournalSnapshot(ancestor.value, previous.value)
    remaining.delete(previous)
    ancestor = previous
  }
  const descendantSnapshotIds: string[] = []
  let latest = frontier
  for (let step = 0; step < candidates.length; step++) {
    const children = [...remaining].filter(candidate => candidate.value.previousSnapshotId === latest.value.snapshotId)
    if (children.length === 0) break
    if (children.length !== 1) throw UsageError('Stored TTS attempt contains a forked orphan journal chain; reconciliation is required.')
    const child = children[0] as RetainedJournalEvidence
    validateRenderAdmissionJournalSnapshot(child.value, latest.value)
    latest = child
    descendantSnapshotIds.push(child.value.snapshotId)
    remaining.delete(child)
  }
  if (remaining.size > 0) throw UsageError('Stored TTS attempt contains an unchained orphan journal; reconciliation is required.')
  return { frontier: latest, descendantSnapshotIds }
}
