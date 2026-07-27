import type { SttBatchBlockedProviderReason } from '~/types'

export type SttBatchCoordinatedTargetSelection = {
  index: number
  queueWaitMs: number
}

export type SttBatchAttemptDecision =
  | { action: 'run' }
  | { action: 'skip', reason: SttBatchBlockedProviderReason }
  | { action: 'defer' }

export type SttBatchProviderAvailability =
  | { action: 'run', activeCount: number, slotLimit: number }
  | { action: 'skip', reason: SttBatchBlockedProviderReason, activeCount: number, slotLimit: number }
  | { action: 'defer', activeCount: number, slotLimit: number, cooldownMs?: number | undefined }
