
export type ProviderModelBase<P extends string = string, M extends string = string> = {
  provider: P
  model: M
}

export type RateEstimateBase<P extends string = string, M extends string = string> =
  ProviderModelBase<P, M> & {
    note?: string
  }

export type CostEstimateBase<P extends string = string, M extends string = string> =
  ProviderModelBase<P, M> & {
    totalCost: number
    costMultiplier?: number
    note?: string
  }
