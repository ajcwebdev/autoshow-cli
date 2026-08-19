import type {
  CanonicalAudioProviderProjection,
  CurrentTtsReconciliationBlocker,
  LoadedRecoveryBatch,
  PipelineProviderState,
  PlannedCost,
  ProviderRenderResult,
  PureCurrentTtsRenderPlanOptions,
  RetainedJournalEvidence,
} from '~/types'

export type AggregateProviderResult = {
  value: ProviderRenderResult
  path: string
  sha256: string
  journalEvidence: RetainedJournalEvidence
}

export type RecoveryFinalizationInput = {
  options: PureCurrentTtsRenderPlanOptions & {
    rootDir: string
    state: PipelineProviderState
    onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
  }
  pure: ReturnType<typeof import('~/cli/commands/process-steps/step-4-tts/script-to-audio/attempt-planning').buildPureCurrentTtsRenderPlan>
  resultProjection: CanonicalAudioProviderProjection
  retainedRender: CanonicalAudioProviderProjection['renderHistory'][number]
  renderRoot: string
  providerRoot: string
  terminalJournalEvidence: RetainedJournalEvidence
  loadedBatches: LoadedRecoveryBatch[]
  retainedCumulativePlannedCost: PlannedCost
  reconciliationBlockers: CurrentTtsReconciliationBlocker[]
  aggregate?: AggregateProviderResult | undefined
}
