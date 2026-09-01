import type { ImageRuntimeOptions, PricingRuntimeOptions, ResourceGate } from '~/types'

export type StandaloneImageCommandOptions = ImageRuntimeOptions & PricingRuntimeOptions & {
  generationResourceGate?: ResourceGate | undefined
}
