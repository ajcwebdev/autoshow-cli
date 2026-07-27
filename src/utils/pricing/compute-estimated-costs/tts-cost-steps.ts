import { getTtsCost, getTtsEstimation, getTtsPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ComputeEstimatedCostsInput, CostStepsResult, EstimatedStepEntry } from '~/types'
import { applyCostMultiplier, computeTtsCost } from '../cost-helpers'
import { resolveCostMultiplier } from './cost-steps-shared'

export const buildTtsCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const steps: EstimatedStepEntry[] = []
  let cost = 0

  const ttsTargets = input.ttsTargets && input.ttsTargets.length > 0
    ? input.ttsTargets
    : input.ttsService && input.ttsModel
      ? [{ service: input.ttsService, model: input.ttsModel }]
      : []

  for (const ttsTarget of ttsTargets) {
    const resolvedTtsCharacterCount = typeof input.ttsCharacterCount === 'number' ? input.ttsCharacterCount : 0
    const ttsCost = computeTtsCost(ttsTarget.service, ttsTarget.model, resolvedTtsCharacterCount)
    const estimation = getTtsEstimation(ttsTarget.service, ttsTarget.model)
    const costMultiplier = resolveCostMultiplier(input, estimation.costMultiplier)
    const pricing = getTtsPricing(ttsTarget.service, ttsTarget.model)
    const hasDualRates = pricing.inputCostPer1MCharsCents !== undefined && pricing.outputCostPer1MCharsCents !== undefined
    const costPer1kCharsCents = hasDualRates ? undefined : (pricing.costPer1kCharsCents ?? getTtsCost(ttsTarget.service, ttsTarget.model))

    const setupCost = ttsTarget.setupCostCents ?? 0
    const stepCost = applyCostMultiplier(ttsCost.cost, costMultiplier) + setupCost
    cost += stepCost
    steps.push({
      step: 'tts',
      provider: ttsTarget.service,
      model: ttsTarget.model,
      cost: stepCost,
      costMultiplier,
      ...(typeof ttsTarget.setupCostCents === 'number' ? { setupCostCents: setupCost } : {}),
      ...(costPer1kCharsCents !== undefined ? { costPer1kCharactersCents: costPer1kCharsCents } : {}),
      ...(pricing.inputCostPer1MCharsCents !== undefined ? { inputCostPer1MCharactersCents: pricing.inputCostPer1MCharsCents } : {}),
      ...(pricing.outputCostPer1MCharsCents !== undefined ? { outputCostPer1MCharactersCents: pricing.outputCostPer1MCharsCents } : {})
    })
  }

  return { steps, cost }
}
