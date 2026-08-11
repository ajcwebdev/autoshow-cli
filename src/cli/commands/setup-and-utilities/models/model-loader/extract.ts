import { DEFAULT_COST_MULTIPLIER, DEFAULT_EXTRACT_MS_PER_PAGE } from './defaults'
import { getModelRegistry } from './registry'
import { getRetiredModelRate } from './retired-model-rates'
import type { ExtractEstimation, ExtractLimits } from '~/types'

export const getExtractPricing = (
  service: string,
  model: string
): {
  costPer1kPagesCents?: number
  inputCostPer1MCents?: number
  cachedInputCostPer1MCents?: number
  outputCostPer1MCents?: number
  tokenPricingBands?: Array<{
    label?: string | undefined
    minInputTokens?: number | undefined
    maxInputTokens?: number | undefined
    inputCostPer1MCents: number
    outputCostPer1MCents: number
    note?: string | undefined
  }> | undefined
  higherContextPricing?: { thresholdInputTokens: number, note: string } | undefined
} => {
  const extractModel = getModelRegistry().extract[service]?.models[model]
    ?? getRetiredModelRate('extract', service, model)
  if (!extractModel) return {}
  return {
    ...(extractModel.costPer1kPagesCents !== undefined
      ? { costPer1kPagesCents: extractModel.costPer1kPagesCents }
      : {}),
    ...(extractModel.costPerMInputTokensCents !== undefined
      ? { inputCostPer1MCents: extractModel.costPerMInputTokensCents }
      : {}),
    ...(extractModel.costPerMCachedInputTokensCents !== undefined
      ? { cachedInputCostPer1MCents: extractModel.costPerMCachedInputTokensCents }
      : {}),
    ...(extractModel.costPerMOutputTokensCents !== undefined
      ? { outputCostPer1MCents: extractModel.costPerMOutputTokensCents }
      : {}),
    ...(extractModel.tokenPricingBands !== undefined ? { tokenPricingBands: extractModel.tokenPricingBands } : {}),
    ...(extractModel.higherContextPricing !== undefined ? { higherContextPricing: extractModel.higherContextPricing } : {})
  }
}

export const getExtractLimits = (
  service: string,
  model: string,
  format?: string
): ExtractLimits => {
  const limits = getModelRegistry().extract[service]?.models[model]?.limits
  const normalizedFormat = format?.toLowerCase()
  const effectiveBytes = limits?.effectiveBytes
    ?? (normalizedFormat === 'pdf'
      ? limits?.pdfBytes
      : normalizedFormat === 'png' || normalizedFormat === 'jpg' || normalizedFormat === 'tif' || normalizedFormat === 'webp' || normalizedFormat === 'bmp' || normalizedFormat === 'gif'
        ? limits?.imageBytes
        : undefined)

  return {
    ...(effectiveBytes !== undefined ? { effectiveBytes } : {}),
    ...(limits?.imageBytes !== undefined ? { imageBytes: limits.imageBytes } : {}),
    ...(limits?.pdfBytes !== undefined ? { pdfBytes: limits.pdfBytes } : {}),
    ...(limits?.pageCount !== undefined ? { pageCount: limits.pageCount } : {}),
    ...(limits?.notes !== undefined ? { notes: limits.notes } : {})
  }
}

export const getExtractEstimation = (service: string, model: string): ExtractEstimation => {
  const modelMeta = getModelRegistry().extract[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerPage: modelMeta?.estimation?.msPerPage ?? DEFAULT_EXTRACT_MS_PER_PAGE,
    ...(modelMeta?.estimation?.singlePagePdfFallbackMsPerPage !== undefined
      ? { singlePagePdfFallbackMsPerPage: modelMeta.estimation.singlePagePdfFallbackMsPerPage }
      : {}),
    ...(modelMeta?.estimation?.promptTokensPerPage !== undefined
      ? { promptTokensPerPage: modelMeta.estimation.promptTokensPerPage }
      : {}),
    ...(modelMeta?.estimation?.completionTokensPerPage !== undefined
      ? { completionTokensPerPage: modelMeta.estimation.completionTokensPerPage }
      : {}),
  }
}
