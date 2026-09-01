import type { MusicRuntimeOptions, PricingRuntimeOptions, ResourceGate } from '~/types'

export type StandaloneMusicCommandOptions = MusicRuntimeOptions & PricingRuntimeOptions & {
  generationResourceGate?: ResourceGate | undefined
}
