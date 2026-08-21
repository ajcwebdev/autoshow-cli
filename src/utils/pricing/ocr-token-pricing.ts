import type { HostedOcrTokenReasoningPolicy, HostedOcrTokenUsageEstimate, HostedOcrTokenUsageProfile, OcrTokenRateInput, TokenPricedOcrProvider } from '~/types'
import { computeTokenCost } from './token-pricing'
import { selectBestScoredProfile } from '~/utils/json-profile-store'

export const computeOcrTokenCost = (
  pricing: OcrTokenRateInput,
  fallbackInputCostPer1MCents: number,
  fallbackOutputCostPer1MCents: number,
  promptTokens: number,
  completionTokens: number
) => computeTokenCost({
  inputCostPer1MCents: pricing.inputCostPer1MCents ?? fallbackInputCostPer1MCents,
  outputCostPer1MCents: pricing.outputCostPer1MCents ?? fallbackOutputCostPer1MCents,
  ...(pricing.tokenPricingBands !== undefined ? { tokenPricingBands: pricing.tokenPricingBands } : {}),
  ...(pricing.higherContextPricing !== undefined ? { higherContextPricing: pricing.higherContextPricing } : {})
}, promptTokens, completionTokens)

const scoreProfile = (
  profile: HostedOcrTokenUsageProfile,
  input: {
    provider: TokenPricedOcrProvider
    model: string
    ocrMode: string
    pageCountBand: string
    effectiveReasoningEffort: HostedOcrTokenReasoningPolicy
  }
): number => {
  if (profile.provider !== input.provider || profile.model !== input.model) {
    return -1
  }
  if (
    profile.effectiveReasoningEffort !== input.effectiveReasoningEffort
    && profile.effectiveReasoningEffort !== 'unspecified'
  ) {
    return -1
  }

  let score = profile.effectiveReasoningEffort === input.effectiveReasoningEffort ? 8 : 0
  if (profile.ocrMode === input.ocrMode) score += 4
  if (profile.pageCountBand === input.pageCountBand) score += 2
  return score
}

export const selectHostedOcrTokenUsageProfile = (
  profiles: readonly HostedOcrTokenUsageProfile[],
  input: {
    provider: TokenPricedOcrProvider
    model: string
    ocrMode: string
    pageCountBand: string
    effectiveReasoningEffort: HostedOcrTokenReasoningPolicy
  }
): HostedOcrTokenUsageProfile | undefined =>
  selectBestScoredProfile(profiles, (profile) => scoreProfile(profile, input))

export const projectHostedOcrTokenUsageEstimate = (input: {
  pageCount: number
  ocrMode: string
  pageCountBand: string
  effectiveReasoningEffort: HostedOcrTokenReasoningPolicy
  registryPromptTokensPerPage: number
  registryCompletionTokensPerPage: number
  profile?: HostedOcrTokenUsageProfile | undefined
}): HostedOcrTokenUsageEstimate => {
  const pageCount = Math.max(0, Math.floor(input.pageCount))
  const registryPromptTokens = Math.max(0, Math.round(pageCount * input.registryPromptTokensPerPage))
  const registryCompletionTokens = Math.max(0, Math.round(pageCount * input.registryCompletionTokensPerPage))
  const profile = input.profile

  if (!profile) {
    return {
      promptTokens: registryPromptTokens,
      completionTokens: registryCompletionTokens,
      tokenEstimateSource: 'registry',
      tokenEstimateConfidence: 'none'
    }
  }

  const exactMatch = profile.ocrMode === input.ocrMode
    && profile.pageCountBand === input.pageCountBand
    && profile.effectiveReasoningEffort === input.effectiveReasoningEffort
  if (exactMatch && profile.sourceConfidence === 'healthy') {
    return {
      promptTokens: Math.max(0, Math.round(pageCount * profile.promptTokensPerPage)),
      completionTokens: Math.max(0, Math.round(pageCount * profile.completionTokensPerPage)),
      tokenEstimateSource: 'profile',
      tokenEstimateConfidence: profile.sourceConfidence,
      tokenProfileSampleCount: profile.sampleCount,
      tokenProfilePromptTokensPerPage: profile.promptTokensPerPage,
      tokenProfileCompletionTokensPerPage: profile.completionTokensPerPage,
      tokenProfileEffectiveReasoningEffort: profile.effectiveReasoningEffort
    }
  }

  const sampleWeight = Math.max(1, Math.min(2, profile.sampleCount))
  const promptTokensPerPage = ((profile.promptTokensPerPage * sampleWeight) + (input.registryPromptTokensPerPage * 2)) / (sampleWeight + 2)
  const completionTokensPerPage = ((profile.completionTokensPerPage * sampleWeight) + (input.registryCompletionTokensPerPage * 2)) / (sampleWeight + 2)
  return {
    promptTokens: Math.max(0, Math.round(pageCount * promptTokensPerPage)),
    completionTokens: Math.max(0, Math.round(pageCount * completionTokensPerPage)),
    tokenEstimateSource: 'blended-profile',
    tokenEstimateConfidence: profile.sourceConfidence,
    tokenProfileSampleCount: profile.sampleCount,
    tokenProfilePromptTokensPerPage: profile.promptTokensPerPage,
    tokenProfileCompletionTokensPerPage: profile.completionTokensPerPage,
    tokenProfileEffectiveReasoningEffort: profile.effectiveReasoningEffort
  }
}
