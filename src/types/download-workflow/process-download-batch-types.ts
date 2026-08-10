import type { BatchItemOutcome, BatchProcessResult, BatchSource, PipelineItemErrorRecord, PipelineItemRecord } from '~/types'

export type BatchSummarySource = {
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
      batchSource: BatchSummarySource | undefined
      itemRecords: PipelineItemRecord[]
    }

export type BatchTallyAccumulator = {
  applyItemResult: (result: BatchItemOutcome, index: number) => void
  recordRejectedItem: (reason: unknown) => void
  finalItemRecords: PipelineItemRecord[]
  partialFailureRecords: PipelineItemErrorRecord[]
  tally: () => { ok: number, partial: number, incomplete: number, fail: number }
  failureExit: () => number | undefined
}
