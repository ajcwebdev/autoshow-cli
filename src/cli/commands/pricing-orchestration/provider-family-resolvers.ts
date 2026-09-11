import { getExtractEstimation, getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { CostSource, EstimatedStepEntry, ExtractionMetadata, StepCostEntry, TokenPricedOcrProvider } from '~/types'
import { isTokenPricedOcrProvider } from '~/types'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import type { EstimatedExtractTarget, ExtractCostEstimateInput } from './extraction-estimate-evidence'
import { resolveExtractTokenEvidence } from './extraction-estimate-evidence'
import { estimatePagePricedExtraction, projectExtractTokenEstimate } from './extraction-estimate-projection'

const PAGE_PRICED_EXTRACT_PROVIDERS = new Set([
  'defuddle',
  'mistral',
  'replicate',
  'fal',
  'firecrawl',
  'glm-reader',
  'spider',
  'supadata',
  'zyte'
])

const LOCAL_ZERO_PROVIDERS = new Set([
  'whisper',
  'whisperfile',
  'youtube-captions',
  'tesseract'
])

const isPagePricedExtractProvider = (provider: string): boolean =>
  PAGE_PRICED_EXTRACT_PROVIDERS.has(provider)

export const zeroCostSource = (provider: string, cost: number, fallback: CostSource): CostSource =>
  cost === 0 && LOCAL_ZERO_PROVIDERS.has(provider) ? 'local_zero' : fallback

const computeActualTokenOcrCost = (
  provider: TokenPricedOcrProvider,
  model: string,
  promptTokens: number,
  completionTokens: number
) => {
  const pricing = getExtractPricing(provider, model)
  return computeTokenCost({
    inputCostPer1MCents: pricing.inputCostPer1MCents ?? 0,
    outputCostPer1MCents: pricing.outputCostPer1MCents ?? 0,
    ...(pricing.tokenPricingBands !== undefined ? { tokenPricingBands: pricing.tokenPricingBands } : {}),
    ...(pricing.higherContextPricing !== undefined ? { higherContextPricing: pricing.higherContextPricing } : {})
  }, promptTokens, completionTokens)
}

const tokenUsageCostSource = (metadata: ExtractionMetadata): CostSource =>
  metadata.providerCostSource === 'partial_provider_usage'
    ? 'partial_provider_usage'
    : (Array.isArray(metadata.ocrProviderUsage) && metadata.ocrProviderUsage.length > 0)
      || typeof metadata.promptTokens === 'number'
      || typeof metadata.completionTokens === 'number'
        ? 'provider_usage'
        : 'computed_usage'

const resolveTokenModel = (
  provider: TokenPricedOcrProvider,
  model: string,
  metadata: ExtractionMetadata
): string | undefined =>
  provider === 'deepinfra' ? model : metadata.ocrModel

export const resolveActualExtractCostEntry = (
  metadata: ExtractionMetadata,
  provider: string,
  model: string
): StepCostEntry | undefined => {
  if (isPagePricedExtractProvider(provider)) {
    const extractPricing = getExtractPricing(provider, model)
    const costPer1kPagesCents = extractPricing.costPer1kPagesCents ?? 0
    const cost = (metadata.totalPages / 1000) * costPer1kPagesCents
    return {
      step: 'extract',
      provider,
      model,
      cost,
      costSource: zeroCostSource(provider, cost, 'registry_fallback'),
      inputMetric: 'pages',
      inputValue: metadata.totalPages
    }
  }

  if (isTokenPricedOcrProvider(provider)) {
    const tokenModel = resolveTokenModel(provider, model, metadata)
    if (typeof tokenModel !== 'string' || tokenModel.length === 0) {
      return undefined
    }

    const promptTokens = metadata.promptTokens ?? 0
    const completionTokens = metadata.completionTokens ?? 0
    const tokenCost = computeActualTokenOcrCost(provider, tokenModel, promptTokens, completionTokens)
    return {
      step: 'extract',
      provider,
      model: tokenModel,
      cost: tokenCost.totalCost,
      costSource: tokenUsageCostSource(metadata),
      inputMetric: 'tokens',
      inputValue: promptTokens + completionTokens,
      promptTokens,
      completionTokens,
      ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
      ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
    }
  }

  if (provider !== 'extract') {
    return {
      step: 'extract',
      provider,
      model,
      cost: 0,
      costSource: zeroCostSource(provider, 0, 'registry_fallback'),
      inputMetric: 'pages',
      inputValue: metadata.totalPages
    }
  }

  return undefined
}

export const resolveEstimatedExtractCostEntry = (
  target: EstimatedExtractTarget,
  input: ExtractCostEstimateInput
): EstimatedStepEntry => {
  const estimation = getExtractEstimation(target.provider, target.model)
  const costMultiplier = input.applyCostMultipliers === false ? 1 : estimation.costMultiplier
  const pageCount = target.pageCount ?? input.extractPageCount ?? 0

  if (isPagePricedExtractProvider(target.provider)) {
    return estimatePagePricedExtraction(target, pageCount, costMultiplier)
  }

  if (!isTokenPricedOcrProvider(target.provider)) {
    return {
      step: 'extract',
      provider: target.provider,
      model: target.model,
      cost: 0,
      costMultiplier,
      ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
      estimateType: target.estimateType ?? 'exact'
    }
  }

  const extractPricing = getExtractPricing(target.provider, target.model)
  const evidence = resolveExtractTokenEvidence(target.provider, target, input, pageCount)
  const { promptTokens, completionTokens } = evidence
  const tokenCost = computeTokenCost(
    {
      inputCostPer1MCents: extractPricing.inputCostPer1MCents ?? 0,
      outputCostPer1MCents: extractPricing.outputCostPer1MCents ?? 0,
      ...(extractPricing.tokenPricingBands !== undefined ? { tokenPricingBands: extractPricing.tokenPricingBands } : {}),
      ...(extractPricing.higherContextPricing !== undefined ? { higherContextPricing: extractPricing.higherContextPricing } : {})
    },
    promptTokens,
    completionTokens,
    costMultiplier
  )

  return projectExtractTokenEstimate(target, extractPricing, costMultiplier, evidence, tokenCost)
}

export const resolveEstimatedExtractProcessingMs = (
  target: {
    provider: string
    model: string
    pageCount?: number | undefined
  },
  extractPageCount?: number | undefined,
  options: { pageConcurrency?: number | undefined } = {}
): { pageCount: number, processingTimeMs: number } => {
  const pageCount = Math.max(0, target.pageCount ?? extractPageCount ?? 0)
  const estimation = getExtractEstimation(target.provider, target.model)
  const pageConcurrency = typeof options.pageConcurrency === 'number' && Number.isFinite(options.pageConcurrency)
    ? Math.max(1, Math.floor(options.pageConcurrency))
    : 1
  const pageBatches = pageCount > 0 ? Math.ceil(pageCount / Math.min(pageCount, pageConcurrency)) : 0
  return {
    pageCount,
    processingTimeMs: Math.max(0, Math.round(pageBatches * estimation.msPerPage))
  }
}
