import type { SttBatchSummaryItem } from '~/types'

export type SttBatchSummary = {
  schemaVersion: 2
  kind: 'stt-batch-summary'
  source?: {
    sourceKind?: string | undefined
    sourceUrl?: string | undefined
    title?: string | undefined
    author?: string | undefined
    selectedCount?: number | undefined
  } | undefined
  totals: {
    items: number
    captionBacked: number
    sttFallback: number
    skipped: number
    incomplete: number
    failed: number
  }
  items: SttBatchSummaryItem[]
}
