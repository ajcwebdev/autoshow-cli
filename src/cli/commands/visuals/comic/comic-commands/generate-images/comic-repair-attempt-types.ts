import type {
  PageQaRepairDecision,
  QaRepairCostEntry
} from '~/types'

export type QaAttemptTotals = {
  totalDurationMs: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  imagesGenerated: number
  imageInputUnits: number
  textInputUnits: number
  imageOutputUnits: number
  costEntries: QaRepairCostEntry[]
}

export type QaAttemptAction = 'edit' | 'restart'

export type QaRestartReason = 'blocking-class' | 'repeated-hard-failure' | 'comparison-rejected'

export type QaStagnationStop = { attempt: number, repeatedHardFailures: string[], reason: PageQaRepairDecision['reason'] }

export type QaRepairRefusal = { attempt: number; reason: string }

export type QaRepairActionState = { action: QaAttemptAction; restartReason: QaRestartReason | undefined }
