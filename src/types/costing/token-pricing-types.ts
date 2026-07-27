export type TokenPricingBand = {
  label?: string | undefined
  minInputTokens?: number | undefined
  maxInputTokens?: number | undefined
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  note?: string | undefined
}

export type TokenPricingConfig = {
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  tokenPricingBands?: TokenPricingBand[] | undefined
  higherContextPricing?: {
    thresholdInputTokens: number
    note: string
  } | undefined
}

export type TokenCostResult = {
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  inputCost: number
  outputCost: number
  totalCost: number
  costMultiplier: number
  pricingBand?: string | undefined
  pricingNote?: string | undefined
}
