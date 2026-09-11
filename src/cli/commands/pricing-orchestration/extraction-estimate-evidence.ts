import { estimateOcrTokenUsage } from '~/cli/commands/text/ocr/ocr-pricing/ocr-estimates'
import type { NormalizedReasoningEffort, TokenPricedOcrProvider } from '~/types'

export type EstimatedExtractTarget = {
  provider: string
  model: string
  pageCount?: number | undefined
  promptTokens?: number | undefined
  completionTokens?: number | undefined
  effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
  ocrMode?: string | undefined
  tokenEstimateSource?: 'exact' | 'profile' | 'blended-profile' | 'registry' | undefined
  tokenEstimateConfidence?: 'none' | 'sparse' | 'healthy' | undefined
  tokenProfileSampleCount?: number | undefined
  tokenProfilePromptTokensPerPage?: number | undefined
  tokenProfileCompletionTokensPerPage?: number | undefined
  estimateType?: 'heuristic' | 'exact' | undefined
}

export type ExtractCostEstimateInput = {
  extractPageCount?: number | undefined
  applyCostMultipliers?: boolean | undefined
  hostedOcrTokenProfilePath?: string | undefined
}

export const resolveExtractTokenEvidence = (provider: TokenPricedOcrProvider, target: EstimatedExtractTarget, input: ExtractCostEstimateInput, pageCount: number) => {
  const hasExactPromptTokens = typeof target.promptTokens === 'number'
  const hasExactCompletionTokens = typeof target.completionTokens === 'number'
  const heuristicTokens = hasExactPromptTokens && hasExactCompletionTokens
    ? undefined
    : estimateOcrTokenUsage(provider, target.model, pageCount, {
        ocrMode: target.ocrMode,
        profilePath: input.hostedOcrTokenProfilePath,
        effectiveReasoningEffort: target.effectiveReasoningEffort
      })
  const promptTokens = hasExactPromptTokens ? target.promptTokens as number : heuristicTokens?.promptTokens ?? 0
  const completionTokens = hasExactCompletionTokens ? target.completionTokens as number : heuristicTokens?.completionTokens ?? 0
  return { hasExactPromptTokens, hasExactCompletionTokens, heuristicTokens, promptTokens, completionTokens }
}
