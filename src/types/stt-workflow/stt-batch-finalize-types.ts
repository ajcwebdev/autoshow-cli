import type { ActualCostBreakdown, EstimatedCostBreakdown, ProviderCompletionStatus, ProviderFailure, StepTimingBreakdown, SttProviderState, SttProviderSuccess, SttRequestedProvider, SttTarget } from '~/types'

export type SttProviderStateSummary = {
  requested: number
  applicable: number
  succeeded: number
  failed: number
  missing: number
  skipped: number
}

export type SttBatchDerivedState = {
  successfulProviders: SttProviderSuccess[]
  failures: ProviderFailure[]
  providerStates: SttProviderState[]
  completionStatus: ProviderCompletionStatus
  providerStateSummary: SttProviderStateSummary
  applicableTargets: SttTarget[]
  skippedProviderStates: SttProviderState[]
  missingProviders: SttRequestedProvider[]
  metadataErrors: Array<Record<string, unknown>>
  providerIssueMessages: string[]
}

export type SttBatchCostTiming = {
  cost: {
    estimated: EstimatedCostBreakdown
    observedEstimate: EstimatedCostBreakdown
    actual: ActualCostBreakdown
    aggregate: { estimatedTotalCost: number, actualTotalCost: number }
  }
  timing: {
    estimated: StepTimingBreakdown
    actual: StepTimingBreakdown
    aggregate: Record<string, unknown>
  }
}
