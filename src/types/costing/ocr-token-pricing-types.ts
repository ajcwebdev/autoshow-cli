import type { TokenPricingConfig } from '~/types'

export type OcrTokenRateInput = {
  inputCostPer1MCents?: number | undefined
  outputCostPer1MCents?: number | undefined
  tokenPricingBands?: TokenPricingConfig['tokenPricingBands']
  higherContextPricing?: TokenPricingConfig['higherContextPricing']
}
