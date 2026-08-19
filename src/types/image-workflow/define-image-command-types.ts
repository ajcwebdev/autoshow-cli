import type { ImageRuntimeOptions, ResourceGate } from '~/types'

export type StandaloneImageCommandOptions = ImageRuntimeOptions & {
  generationResourceGate?: ResourceGate | undefined
  price: boolean
  allowOverBudget: boolean
}
