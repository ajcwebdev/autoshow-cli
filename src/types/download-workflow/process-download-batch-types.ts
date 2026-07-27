import type { BatchItemOutcome, BatchManifestEntry, BatchManifestErrorEntry, BatchProcessResult, BatchSource } from '~/types'

export type BatchManifestSummarySource = {
  sourceKind: BatchSource['sourceKind']
  sourceUrl: string
  title: string | undefined
  author: string | undefined
  selectedCount: number
}

export type PrepareBatchRunResult =
  | { done: true, result: BatchProcessResult }
  | {
      done: false
      batchDir: string
      batchDirName: string
      batchSource: BatchManifestSummarySource | undefined
      infoEntries: BatchManifestEntry[]
    }

export type BatchTallyAccumulator = {
  applyItemResult: (result: BatchItemOutcome, index: number) => void
  recordRejectedItem: (reason: unknown) => void
  finalInfoEntries: BatchManifestEntry[]
  partialFailureEntries: BatchManifestErrorEntry[]
  tally: () => { ok: number, partial: number, incomplete: number, fail: number }
  failureExit: () => number | undefined
}
