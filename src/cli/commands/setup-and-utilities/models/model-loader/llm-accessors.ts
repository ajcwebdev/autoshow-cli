import { DEFAULT_COST_MULTIPLIER, DEFAULT_LLM_MS_PER_1K_TOKENS } from './defaults'
import { getModelRegistry, getRegistryServiceType } from './registry'
import { getRetiredModelRate } from './retired-model-rates'
import type { LlmEstimation } from '~/types'

export const getLlmCost = (
  service: string,
  model: string
): {
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  tokenPricingBands?: Array<{
    label?: string | undefined
    minInputTokens?: number | undefined
    maxInputTokens?: number | undefined
    inputCostPer1MCents: number
    outputCostPer1MCents: number
    note?: string | undefined
  }> | undefined
  higherContextPricing?: { thresholdInputTokens: number, note: string } | undefined
} | undefined => {
  const llmModel = getModelRegistry().llm[service]?.models[model]
    ?? getRetiredModelRate('llm', service, model)
  if (
    typeof llmModel?.inputCostPer1MCents !== 'number'
    || typeof llmModel.outputCostPer1MCents !== 'number'
  ) return undefined
  return {
    inputCostPer1MCents: llmModel.inputCostPer1MCents,
    outputCostPer1MCents: llmModel.outputCostPer1MCents,
    ...(llmModel.tokenPricingBands !== undefined ? { tokenPricingBands: llmModel.tokenPricingBands } : {}),
    ...(llmModel.higherContextPricing !== undefined ? { higherContextPricing: llmModel.higherContextPricing } : {})
  }
}

export const getLlmEstimation = (service: string, model: string): LlmEstimation => {
  const serviceType = getRegistryServiceType('llm', service) ?? 'api'
  const modelMeta = getModelRegistry().llm[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPer1KTokens: modelMeta?.estimation?.msPer1KTokens ?? DEFAULT_LLM_MS_PER_1K_TOKENS[serviceType],
  }
}
