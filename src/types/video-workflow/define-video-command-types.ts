import type { ResourceGate, VideoRuntimeOptions } from '~/types'

export type StandaloneVideoCommandOptions = VideoRuntimeOptions & {
  generationResourceGate?: ResourceGate | undefined
  price: boolean
  allowOverBudget: boolean
}
