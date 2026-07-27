import type { HostedOcrProfileStore, HostedOcrSchedulerProfileConfidence, TokenPricedOcrProvider } from '~/types'

export type HostedOcrTokenEstimateSource = 'profile' | 'blended-profile' | 'registry'
export type HostedOcrTokenDisqualificationReason = 'partial' | 'failed' | 'incomplete' | 'missing-usage'

export type HostedOcrTokenUsageEstimate = {
  promptTokens: number
  completionTokens: number
  tokenEstimateSource: HostedOcrTokenEstimateSource
  tokenEstimateConfidence: HostedOcrSchedulerProfileConfidence
  tokenProfileSampleCount?: number | undefined
  tokenProfilePromptTokensPerPage?: number | undefined
  tokenProfileCompletionTokensPerPage?: number | undefined
}

export type HostedOcrTokenUsageProfile = {
  provider: TokenPricedOcrProvider
  model: string
  ocrMode: string
  pageCountBand: string
  pageCount: number
  observedPromptTokens: number
  observedCompletionTokens: number
  promptTokensPerPage: number
  completionTokensPerPage: number
  estimatedPromptTokens: number
  estimatedCompletionTokens: number
  promptTokenEstimateDelta: number
  completionTokenEstimateDelta: number
  firstSeenAt: string
  lastSeenAt: string
  sampleCount: number
  sourceConfidence: HostedOcrSchedulerProfileConfidence
  disqualificationReason?: HostedOcrTokenDisqualificationReason | undefined
}

export type HostedOcrTokenUsageProfileStore = HostedOcrProfileStore<1, HostedOcrTokenUsageProfile>
