import type { BatchItem, BatchItemProcessResult, BatchManifestEntry, BatchRunOptions, ProcessCommand, RuntimeOptions } from '~/types'

export type BatchItemProcessor = (
  command: ProcessCommand,
  item: string,
  batchDir: string,
  opts: RuntimeOptions,
  batchItem?: BatchItem
) => Promise<BatchItemProcessResult | void>

export type ExecuteBatchItemContext = {
  command: ProcessCommand
  batchDir: string
  batchDirName: string
  opts: RuntimeOptions
  runOpts: BatchRunOptions
  processSingleTarget: BatchItemProcessor
  sttLike: boolean
  itemCount: number
}

export type BatchItemOutcome = {
  manifestEntry: BatchManifestEntry | null
  errorCount: number
  status: 'ok' | 'partial' | 'incomplete' | 'failed'
  failureError?: unknown
}
