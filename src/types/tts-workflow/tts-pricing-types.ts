import type { CostEstimateBase, RateEstimateBase, TtsProvider } from '~/types'

export type TtsCostEstimate = CostEstimateBase<TtsProvider> & {
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
  characterCount: number
  setupCostCents?: number | undefined
  setupTimeMs?: number | undefined
  setupNote?: string | undefined
}

export type TtsRateEstimate = RateEstimateBase<TtsProvider> & {
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
}
