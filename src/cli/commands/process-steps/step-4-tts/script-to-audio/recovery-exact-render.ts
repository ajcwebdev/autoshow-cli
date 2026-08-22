import { resolve } from 'node:path'
import type { PipelineProviderState, PureCurrentTtsRenderPlanOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { buildPureCurrentTtsRenderPlan } from './attempt-planning'
import { discoverBatchCandidates } from './recovery-batch-discovery'
import { loadRecoveryBatches } from './recovery-batch-reconstruction'
import { reconcileSlotCosts } from './recovery-cost-reconciliation'
import { assembleCompletedRenderRecovery } from './recovery-finalization'
import { collectRetainedJournalEvidence, prepareCompactRenderRecovery, prepareSelectedSuccess, resolveRetainedPath, validateRecoveryProjections } from './recovery-evidence'

export const prepareCurrentTtsCompletedRecoveryImpl = async (
    options: PureCurrentTtsRenderPlanOptions & {
      rootDir: string
      state: PipelineProviderState
      onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
      reconciliationMode?: 'enforce' | 'report' | undefined
    }
  ) => {
    const pure = buildPureCurrentTtsRenderPlan(options)
    const { resultProjection } = validateRecoveryProjections(options, pure)
    const compactRecovery = await prepareCompactRenderRecovery(options, pure, resultProjection)
    if (compactRecovery) return compactRecovery
    const retainedRender = resultProjection.renderHistory.find((entry) =>
      entry.renderIdentity === pure.renderIdentity)
    if (!retainedRender) {
      throw CLIUsageError(`Stored TTS target ${options.state.service}/${options.state.model ?? ''} does not match the exact planned render identity; rebuild instead of resuming it.`)
    }
    const providerRoot = resolve(options.rootDir, options.state.artifactDir)
    const renderRoot = resolveRetainedPath(
      providerRoot,
      retainedRender.renderDir,
      'Stored TTS render directory'
    )
    const plannedSlotIds = pure.planned.slots.map((slot) => slot.generationSlotId)
    const evidence = await collectRetainedJournalEvidence(
      options,
      pure,
      providerRoot,
      retainedRender,
      plannedSlotIds
    )
    if (!evidence.terminalJournalEvidence) return undefined
    const selectedRecovery = await prepareSelectedSuccess(
      options,
      pure,
      resultProjection,
      retainedRender,
      providerRoot,
      renderRoot,
      plannedSlotIds
    )
    if (selectedRecovery) return selectedRecovery
    const candidates = await discoverBatchCandidates(
      options,
      pure,
      renderRoot,
      evidence.journalEvidenceById,
      retainedRender
    )
    const loadedBatches = await loadRecoveryBatches(
      options,
      pure,
      candidates,
      evidence.journalEvidenceById,
      evidence.knownJournalSnapshots
    )
    const costs = reconcileSlotCosts(pure, evidence.journalEvidenceById, loadedBatches, options)
    if (loadedBatches.length === 0) {
      return {
        kind: 'safe-redispatch' as const,
        retainedCumulativePlannedCost: costs.retainedCumulativePlannedCost,
        reconciliationBlockers: costs.reconciliationBlockers
      }
    }
    const allCompleted = plannedSlotIds.every((slotId) =>
      loadedBatches.some((batch) => batch.value.generationSlotId === slotId))
    if (!allCompleted) {
      if (pure.planned.strategy !== 'segmented') {
        throw CLIUsageError('Partial completed-slot recovery is supported only for immutable segmented dialogue renders; redispatch is blocked.')
      }
      return {
        kind: 'partial-slots' as const,
        recoveredSlots: loadedBatches,
        retainedCumulativePlannedCost: costs.retainedCumulativePlannedCost,
        reconciliationBlockers: costs.reconciliationBlockers
      }
    }
    return await assembleCompletedRenderRecovery(
      options,
      pure,
      resultProjection,
      retainedRender,
      renderRoot,
      providerRoot,
      evidence.journalEvidenceById,
      evidence.terminalJournalEvidence,
      loadedBatches,
      costs.retainedCumulativePlannedCost,
      costs.reconciliationBlockers
    )
}
