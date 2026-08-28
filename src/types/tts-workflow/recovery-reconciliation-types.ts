import type { CurrentTtsRecoveredGenerationSlot, ProviderBatchResult } from '~/types'

export type LoadedRecoveryBatch = CurrentTtsRecoveredGenerationSlot & Readonly<{
  value: Extract<ProviderBatchResult, { provenance: 'provider-dispatch' }>
  attemptRoot: string
}>
