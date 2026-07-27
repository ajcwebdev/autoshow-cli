import type { ExtractStepEstimate, TokenPricedOcrProvider } from '~/types'

export type HostedOcrPricingService = TokenPricedOcrProvider | 'mistral'

export type OcrCostEstimate = {
  provider: ExtractStepEstimate['provider']
  model: string
  totalCost: number
  costPer1kPagesCents?: number | undefined
  inputCostPer1MCents?: number | undefined
  outputCostPer1MCents?: number | undefined
  pricingBand?: string | undefined
  pricingNote?: string | undefined
  pageCount?: number | undefined
  promptTokens?: number | undefined
  completionTokens?: number | undefined
  ocrMode?: string | undefined
  tokenEstimateSource?: 'exact' | 'profile' | 'blended-profile' | 'registry' | undefined
  tokenEstimateConfidence?: 'none' | 'sparse' | 'healthy' | undefined
  tokenProfileSampleCount?: number | undefined
  tokenProfilePromptTokensPerPage?: number | undefined
  tokenProfileCompletionTokensPerPage?: number | undefined
  estimateType?: ExtractStepEstimate['estimateType'] | undefined
  note?: string | undefined
}

export type HostedOcrEstimateOptions = {
  hostedOcrTokenProfilePath?: string | undefined
}

export type HostedOcrEstimateHandler = {
  estimate: (model: string, input: string, options?: HostedOcrEstimateOptions | undefined) => Promise<OcrCostEstimate>
  note?: string | ((estimate: OcrCostEstimate) => string | undefined) | undefined
  estimateType?: ExtractStepEstimate['estimateType'] | undefined
}
