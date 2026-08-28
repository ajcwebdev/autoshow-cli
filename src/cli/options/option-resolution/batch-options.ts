import type { BatchRuntimeOptions } from '~/types'
import {
  parseIntWithDefault,
  readBatchLimit,
  readBatchOrder,
  readBooleanFlag,
  readOptionalStringFlag
} from './flag-readers'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'

export const buildBatchOptions = (mergedFlags: Record<string, unknown>): BatchRuntimeOptions => ({
  batchLimit: readBatchLimit(mergedFlags),
  batchOrder: readBatchOrder(mergedFlags),
  batchConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'batch-concurrency'), DEFAULT_CLI_CONCURRENCY)),
  keepOriginalMedia: readBooleanFlag(mergedFlags, 'keep-original-media'),
  bestQuality: readBooleanFlag(mergedFlags, 'best-quality'),
  flatBatch: readBooleanFlag(mergedFlags, 'flat-batch'),
})
