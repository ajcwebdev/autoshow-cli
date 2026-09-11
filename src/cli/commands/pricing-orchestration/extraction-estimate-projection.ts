import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { EstimatedStepEntry } from '~/types'
import type { computeTokenCost } from '~/utils/pricing/token-pricing'
import { applyCostMultiplier } from './cost-helpers'
import type { EstimatedExtractTarget } from './extraction-estimate-evidence'
import type { resolveExtractTokenEvidence } from './extraction-estimate-evidence'

export const estimatePagePricedExtraction = (target: EstimatedExtractTarget, pageCount: number, costMultiplier: number): EstimatedStepEntry => {
  const extractPricing = getExtractPricing(target.provider, target.model)
  const cost = applyCostMultiplier(
    (pageCount / 1000) * (extractPricing.costPer1kPagesCents ?? 0),
    costMultiplier
  )
  return {
    step: 'extract',
    provider: target.provider,
    model: target.model,
    cost,
    costMultiplier,
    ...(typeof extractPricing.costPer1kPagesCents === 'number' ? { costPer1kPagesCents: extractPricing.costPer1kPagesCents } : {}),
    ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
    estimateType: target.estimateType ?? 'exact'
  }
}

export const projectExtractTokenEstimate = (target: EstimatedExtractTarget, extractPricing: ReturnType<typeof getExtractPricing>, costMultiplier: number, evidence: ReturnType<typeof resolveExtractTokenEvidence>, tokenCost: ReturnType<typeof computeTokenCost>): EstimatedStepEntry => {
  const { hasExactPromptTokens, hasExactCompletionTokens, heuristicTokens, promptTokens, completionTokens } = evidence
  return {
    step: 'extract',
    provider: target.provider,
    model: target.model,
    cost: tokenCost.totalCost,
    costMultiplier,
    ...(typeof extractPricing.inputCostPer1MCents === 'number' ? { inputCostPer1MCents: tokenCost.inputCostPer1MCents } : {}),
    ...(typeof extractPricing.outputCostPer1MCents === 'number' ? { outputCostPer1MCents: tokenCost.outputCostPer1MCents } : {}),
    ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
    ...(typeof target.ocrMode === 'string' ? { ocrMode: target.ocrMode } : {}),
    promptTokens,
    completionTokens,
    tokenEstimateSource: hasExactPromptTokens && hasExactCompletionTokens
      ? 'exact'
      : heuristicTokens?.tokenEstimateSource ?? target.tokenEstimateSource ?? 'registry',
    tokenEstimateConfidence: hasExactPromptTokens && hasExactCompletionTokens
      ? 'healthy'
      : heuristicTokens?.tokenEstimateConfidence ?? target.tokenEstimateConfidence ?? 'none',
    ...(typeof heuristicTokens?.tokenProfileSampleCount === 'number'
      ? { tokenProfileSampleCount: heuristicTokens.tokenProfileSampleCount }
      : typeof target.tokenProfileSampleCount === 'number'
        ? { tokenProfileSampleCount: target.tokenProfileSampleCount }
        : {}),
    ...(typeof heuristicTokens?.tokenProfilePromptTokensPerPage === 'number'
      ? { tokenProfilePromptTokensPerPage: heuristicTokens.tokenProfilePromptTokensPerPage }
      : typeof target.tokenProfilePromptTokensPerPage === 'number'
        ? { tokenProfilePromptTokensPerPage: target.tokenProfilePromptTokensPerPage }
        : {}),
    ...(typeof heuristicTokens?.tokenProfileCompletionTokensPerPage === 'number'
      ? { tokenProfileCompletionTokensPerPage: heuristicTokens.tokenProfileCompletionTokensPerPage }
      : typeof target.tokenProfileCompletionTokensPerPage === 'number'
        ? { tokenProfileCompletionTokensPerPage: target.tokenProfileCompletionTokensPerPage }
        : {}),
    ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
    ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {}),
    estimateType: target.estimateType ?? (hasExactPromptTokens && hasExactCompletionTokens ? 'exact' : 'heuristic')
  }
}
