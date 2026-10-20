import type { BatchRuntimeOptions } from '~/types'
import {
  parseIntWithDefault,
  readBatchLimit,
  readBatchOrder,
  readBooleanFlag,
  readOptionalStringFlag
} from './flag-readers'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { resolveDownloadMediaQuality } from '~/cli/flags/download-media-quality-contract'

export const buildBatchOptions = (mergedFlags: Record<string, unknown>, explicitFlags: ReadonlySet<string> = new Set()): BatchRuntimeOptions => ({
  batchLimit: readBatchLimit(mergedFlags),
  batchOrder: readBatchOrder(mergedFlags),
  batchConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'batch-concurrency'), DEFAULT_CLI_CONCURRENCY)),
  ...resolveDownloadMediaQuality(mergedFlags, explicitFlags),
  flatBatch: readBooleanFlag(mergedFlags, 'flat-batch'),
})
