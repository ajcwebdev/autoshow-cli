import type { BatchRuntimeOptionKey, RuntimeOptions } from '~/types'
import {
  parseIntWithDefault,
  readBatchOrder,
  readBooleanFlag,
  readOptionalStringFlag
} from '../options/flag-readers'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'

export const buildBatchOptions = (mergedFlags: Record<string, unknown>): Pick<RuntimeOptions, BatchRuntimeOptionKey> => ({
  batchLimit: parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'batch-limit'), 5),
  batchAll: readBooleanFlag(mergedFlags, 'batch-all'),
  batchOrder: readBatchOrder(mergedFlags),
  batchConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'batch-concurrency'), DEFAULT_CLI_CONCURRENCY)),
  keepOriginalMedia: readBooleanFlag(mergedFlags, 'keep-original-media'),
  bestQuality: readBooleanFlag(mergedFlags, 'best-quality'),
  flatBatch: readBooleanFlag(mergedFlags, 'flat-batch'),
})
