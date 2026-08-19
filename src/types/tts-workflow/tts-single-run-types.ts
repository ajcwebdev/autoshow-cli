import type { TtsOptions } from '~/types'

export type StandaloneTtsCommandOptions = TtsOptions & {
  batchConcurrency: number
  price: boolean
  allowOverBudget: boolean
}
