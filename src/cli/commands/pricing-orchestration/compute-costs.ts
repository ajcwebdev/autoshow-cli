import type { AggregatedPriceEstimate, ComputeEstimatedCostsInput, EstimatedCostBreakdown } from '~/types'
import { computeEstimatedCosts } from './compute-estimated-costs'
import { stepEstimateToEstimated } from '~/utils/pricing/step-estimate-fields'

export const preflightToEstimated = (estimate: AggregatedPriceEstimate): EstimatedCostBreakdown => ({
  totalCost: estimate.totalEstimatedCost,
  steps: estimate.steps.map(stepEstimateToEstimated)
})

export const computePriceAlignedEstimatedCosts = (
  preflightEstimate: AggregatedPriceEstimate | undefined,
  input: ComputeEstimatedCostsInput
): EstimatedCostBreakdown =>
  preflightEstimate ? preflightToEstimated(preflightEstimate) : computeEstimatedCosts(input)

export const computeObservedEstimateCosts = (
  input: ComputeEstimatedCostsInput
): EstimatedCostBreakdown => computeEstimatedCosts({
  ...input,
  applyCostMultipliers: false
})
