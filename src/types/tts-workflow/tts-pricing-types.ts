import type { CostEstimateBase, RateEstimateBase, TtsProvider } from '~/types'

export type TtsCostEstimate = CostEstimateBase<TtsProvider> & {
  inputCostPer1MTokensCents?: number
  outputCostPer1MAudioTokensCents?: number
  estimatedTextTokens?: number
  estimatedAudioTokens?: number
  estimatedDurationSeconds?: number
  observedTextTokens?: number
  observedAudioTokens?: number
  rateIdentity?: string
  executionMode?: string
  estimateProvenance?: string
  authorizationBoundCents?: number

  costPerRequestCents?: number
  requestCount?: number
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
  characterCount: number
  setupCostCents?: number | undefined
  setupTimeMs?: number | undefined
  setupNote?: string | undefined
}

export type TtsRateEstimate = RateEstimateBase<TtsProvider> & {
  costPerRequestCents?: number
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
}
