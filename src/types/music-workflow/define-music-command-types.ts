import type { MusicRuntimeOptions, ResourceGate } from '~/types'

export type StandaloneMusicCommandOptions = MusicRuntimeOptions & {
  generationResourceGate?: ResourceGate | undefined
  price: boolean
  allowOverBudget: boolean
}
