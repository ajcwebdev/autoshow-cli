import type { PricingRuntimeOptions, TtsOptions } from '~/types'

export type StandaloneTtsCommandOptions = TtsOptions & PricingRuntimeOptions & {
  batchConcurrency: number
}
