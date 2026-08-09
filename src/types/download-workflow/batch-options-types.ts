import type { BatchOrder } from '~/types'

export type BatchRuntimeOptions = {
  batchLimit: number
  batchAll: boolean
  batchOrder: BatchOrder
  batchConcurrency: number
  keepOriginalMedia: boolean
  bestQuality: boolean
  flatBatch: boolean
}

export type BatchRuntimeOptionKey = keyof BatchRuntimeOptions
