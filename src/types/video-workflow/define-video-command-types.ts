import type { PricingRuntimeOptions, ResourceGate, VideoRuntimeOptions } from '~/types'

export type StandaloneVideoCommandOptions = VideoRuntimeOptions & PricingRuntimeOptions & {
  generationResourceGate?: ResourceGate | undefined
}
