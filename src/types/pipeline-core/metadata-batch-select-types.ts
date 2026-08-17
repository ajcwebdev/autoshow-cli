import type { BatchOrder } from '~/types'

export type MetadataBatchSelectOptions = {
  limit: number | 'all'
  order: BatchOrder
}
