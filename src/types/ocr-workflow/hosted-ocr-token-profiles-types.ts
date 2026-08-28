import type { HostedOcrProfileStore, HostedOcrSchedulerProfileConfidence, NormalizedReasoningEffort, TokenPricedOcrProvider } from '~/types'

export type HostedOcrTokenReasoningPolicy = NormalizedReasoningEffort | 'unspecified'

type HostedOcrTokenEstimateSource = 'profile' | 'blended-profile' | 'registry'
type HostedOcrTokenDisqualificationReason = 'partial' | 'failed' | 'incomplete' | 'missing-usage'

export type HostedOcrTokenUsageEstimate = {
  promptTokens: number
  completionTokens: number
  tokenEstimateSource: HostedOcrTokenEstimateSource
  tokenEstimateConfidence: HostedOcrSchedulerProfileConfidence
  tokenProfileSampleCount?: number | undefined
  tokenProfilePromptTokensPerPage?: number | undefined
  tokenProfileCompletionTokensPerPage?: number | undefined
  tokenProfileEffectiveReasoningEffort?: HostedOcrTokenReasoningPolicy | undefined
}

export type HostedOcrTokenUsageProfile = {
  provider: TokenPricedOcrProvider
  model: string
  ocrMode: string
  pageCountBand: string
  effectiveReasoningEffort: HostedOcrTokenReasoningPolicy
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

export type HostedOcrTokenUsageProfileStore = HostedOcrProfileStore<2, HostedOcrTokenUsageProfile>
