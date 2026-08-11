import type { BatchItem, BatchItemProcessResult, BatchRunOptions, PipelineItemRecord, ProcessCommand } from '~/types'

export type BatchItemProcessor<TOptions extends object> = (
  command: ProcessCommand,
  item: string,
  batchDir: string,
  opts: TOptions,
  batchItem?: BatchItem
) => Promise<BatchItemProcessResult | void>

export type ExecuteBatchItemContext<TOptions extends object> = {
  command: ProcessCommand
  batchDir: string
  batchDirName: string
  opts: TOptions
  runOpts: BatchRunOptions
  processSingleTarget: BatchItemProcessor<TOptions>
  sttLike: boolean
  itemCount: number
}

export type BatchItemOutcome = {
  itemRecord: PipelineItemRecord | null
  errorCount: number
  status: 'ok' | 'partial' | 'incomplete' | 'failed'
  failureError?: unknown
}
