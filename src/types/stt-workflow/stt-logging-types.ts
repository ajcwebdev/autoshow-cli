import type { SttSplitDecisionReason } from '~/types'

export type SttSplitRetryReason = Exclude<SttSplitDecisionReason['kind'], 'explicit'>
