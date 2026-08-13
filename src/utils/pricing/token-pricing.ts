import type { TokenCostResult, TokenPricingBand, TokenPricingConfig } from '~/types'
import { applyCostMultiplier } from './cost-multiplier'

const normalizeTokens = (tokens: number): number =>
  Number.isFinite(tokens) ? Math.max(0, tokens) : 0

const matchesBand = (band: TokenPricingBand, inputTokens: number): boolean => {
  const min = band.minInputTokens
  const max = band.maxInputTokens

  return (typeof min !== 'number' || inputTokens >= min)
    && (typeof max !== 'number' || inputTokens <= max)
}

const selectTokenPricingBand = (
  pricing: TokenPricingConfig,
  inputTokens: number
): TokenPricingBand | undefined =>
  pricing.tokenPricingBands?.find((band) => matchesBand(band, inputTokens))

export const computeTokenCost = (
  pricing: TokenPricingConfig,
  inputTokens: number,
  outputTokens: number,
  costMultiplier = 1
): TokenCostResult => {
  const normalizedInputTokens = normalizeTokens(inputTokens)
  const normalizedOutputTokens = normalizeTokens(outputTokens)
  const selectedBand = selectTokenPricingBand(pricing, normalizedInputTokens)
  const inputCostPer1MCents = selectedBand?.inputCostPer1MCents ?? pricing.inputCostPer1MCents
  const outputCostPer1MCents = selectedBand?.outputCostPer1MCents ?? pricing.outputCostPer1MCents
  const inputCost = (normalizedInputTokens / 1_000_000) * inputCostPer1MCents
  const outputCost = (normalizedOutputTokens / 1_000_000) * outputCostPer1MCents
  const rawTotalCost = inputCost + outputCost
  const higherContextNote = pricing.higherContextPricing
    && normalizedInputTokens > pricing.higherContextPricing.thresholdInputTokens
    ? pricing.higherContextPricing.note
    : undefined

  return {
    inputCostPer1MCents,
    outputCostPer1MCents,
    inputCost: applyCostMultiplier(inputCost, costMultiplier),
    outputCost: applyCostMultiplier(outputCost, costMultiplier),
    totalCost: applyCostMultiplier(rawTotalCost, costMultiplier),
    costMultiplier,
    ...(typeof selectedBand?.label === 'string' ? { pricingBand: selectedBand.label } : {}),
    ...(typeof selectedBand?.note === 'string'
      ? { pricingNote: selectedBand.note }
      : typeof higherContextNote === 'string'
        ? { pricingNote: higherContextNote }
        : {})
  }
}
