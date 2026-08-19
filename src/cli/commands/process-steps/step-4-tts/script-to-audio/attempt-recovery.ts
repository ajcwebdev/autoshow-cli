import type { PipelineProviderState } from '~/types'
import type {
  CurrentTtsCompletedRecovery,
  CurrentTtsPartialRecovery,
  CurrentTtsResumePricePlan,
  CurrentTtsSafeRedispatch,
  PureCurrentTtsRenderPlanOptions,
} from './attempt-shared'
import {
  planCurrentTtsResumePriceImpl,
  prepareCurrentTtsCompatibleSlotRecoveryImpl,
  prepareCurrentTtsCompletedRecoveryImpl,
} from './recovery-reconciliation'

export {
  collectRetainedJournalEvidence,
  prepareCompactRenderRecovery,
  prepareSelectedSuccess,
  readJournalSnapshotFromLedger,
  readLatestJournalSnapshot,
  resolveCurrentTtsPriorAdmittedAttemptCount,
  resolveRetainedPath,
  validateRecoveryProjections,
} from './recovery-evidence'
export type { RetainedJournalEvidence } from './recovery-evidence'
export { discoverBatchCandidates } from './recovery-batch-discovery'
export type { RetainedBatchCandidate } from './recovery-batch-discovery'
export {
  loadRecoveryBatches,
  reconcileSlotCosts,
} from './recovery-reconciliation'
export type { LoadedRecoveryBatch } from './recovery-reconciliation'
export { assembleCompletedRenderRecovery } from './recovery-finalization'

export const prepareCurrentTtsCompletedRecovery = async (options: PureCurrentTtsRenderPlanOptions & {
  rootDir: string
  state: PipelineProviderState
  onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
  reconciliationMode?: 'enforce' | 'report' | undefined
}): Promise<CurrentTtsCompletedRecovery | CurrentTtsPartialRecovery | CurrentTtsSafeRedispatch | undefined> =>
  await prepareCurrentTtsCompletedRecoveryImpl(options)

export const prepareCurrentTtsCompatibleSlotRecovery = async (options: PureCurrentTtsRenderPlanOptions & {
  rootDir: string
  outputDir: string
  artifactRoot?: string | undefined
  state: PipelineProviderState
  materialize?: boolean | undefined
  reconciliationMode?: 'enforce' | 'report' | undefined
}): Promise<CurrentTtsPartialRecovery | CurrentTtsSafeRedispatch | undefined> =>
  await prepareCurrentTtsCompatibleSlotRecoveryImpl(options)

export const planCurrentTtsResumePrice = async (options: PureCurrentTtsRenderPlanOptions & {
  rootDir: string
  state?: PipelineProviderState | undefined
}): Promise<CurrentTtsResumePricePlan> =>
  await planCurrentTtsResumePriceImpl(options)
