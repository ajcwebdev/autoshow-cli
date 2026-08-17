import type { BatchOrder } from '~/types'

export type BatchRuntimeOptions = {
  batchLimit: number | 'all'
  batchOrder: BatchOrder
  batchConcurrency: number
  keepOriginalMedia: boolean
  bestQuality: boolean
  flatBatch: boolean
}

export type BatchRuntimeOptionKey = keyof BatchRuntimeOptions
