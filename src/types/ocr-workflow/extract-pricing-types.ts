import type { HostedOcrTokenReasoningPolicy, HostedOcrTokenUsageEstimate, TokenPricedOcrProvider } from '~/types'

export type TokenEstimateMetadata = Omit<HostedOcrTokenUsageEstimate, 'promptTokens' | 'completionTokens'>

export type EstimateOcrTokenUsageOptions = {
  ocrMode?: string | undefined
  profilePath?: string | undefined
  effectiveReasoningEffort?: HostedOcrTokenReasoningPolicy | undefined
}

export type TokenOcrCostEstimate<TProvider extends TokenPricedOcrProvider> = {
  provider: TProvider
  model: string
  pageCount: number
  promptTokens: number
  completionTokens: number
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
  pricingBand?: string | undefined
  pricingNote?: string | undefined
  ocrMode?: string | undefined
  estimateType: 'heuristic'
} & TokenEstimateMetadata
