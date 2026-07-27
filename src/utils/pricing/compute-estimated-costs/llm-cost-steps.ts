import { getLlmCost, getLlmEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ComputeEstimatedCostsInput, CostStepsResult, EstimatedStepEntry, Step3Metadata } from '~/types'
import { computeTokenCost } from '../token-pricing'
import { resolveCostMultiplier } from './cost-steps-shared'

export const buildLlmCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const steps: EstimatedStepEntry[] = []
  let cost = 0

  if (input.skipLLM) {
    return { steps, cost }
  }

  const llmTargets = input.llmTargets && input.llmTargets.length > 0
    ? input.llmTargets
    : input.llmService && input.llmModel
      ? [{
          service: input.llmService as Step3Metadata['llmService'],
          model: input.llmModel,
          ...(typeof input.llmInputTokenCount === 'number' ? { inputTokens: input.llmInputTokenCount } : {}),
          ...(typeof input.llmOutputTokenCount === 'number' ? { outputTokens: input.llmOutputTokenCount } : {})
        }]
      : []

  for (const llmTarget of llmTargets) {
    const registryService = llmTarget.service === 'llama.cpp' ? 'llama' : llmTarget.service
    const rates = getLlmCost(registryService, llmTarget.model)
    if (!rates) {
      continue
    }

    const estimation = getLlmEstimation(registryService, llmTarget.model)
    const costMultiplier = resolveCostMultiplier(input, estimation.costMultiplier)
    const estimatedInputTokens = typeof llmTarget.inputTokens === 'number' ? llmTarget.inputTokens : 0
    const estimatedOutputTokens = typeof llmTarget.outputTokens === 'number' ? llmTarget.outputTokens : 0
    const tokenCost = computeTokenCost(rates, estimatedInputTokens, estimatedOutputTokens, costMultiplier)
    cost += tokenCost.totalCost
    steps.push({
      step: 'llm',
      provider: llmTarget.service,
      model: llmTarget.model,
      cost: tokenCost.totalCost,
      costMultiplier,
      inputCostPer1MCents: tokenCost.inputCostPer1MCents,
      outputCostPer1MCents: tokenCost.outputCostPer1MCents,
      estimatedInputTokens,
      estimatedOutputTokens,
      ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
      ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
    })
  }

  return { steps, cost }
}
