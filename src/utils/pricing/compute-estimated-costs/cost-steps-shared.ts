import type { ComputeEstimatedCostsInput, CostStepsResult, EstimatedStepEntry } from '~/types'
import { applyCostMultiplier } from '../cost-helpers'

export const EXACT_COST_MULTIPLIER = 1

export const resolveCostMultiplier = (
  input: Pick<ComputeEstimatedCostsInput, 'applyCostMultipliers'>,
  multiplier: number
): number => input.applyCostMultipliers === false ? 1 : multiplier

/**
 * Shared push/accumulate scaffolding for the Image/Video/Music generation branches,
 * which each estimate a per-target cost, apply the registry cost multiplier, and push
 * a step differing only in `step` label and one identifying quantity (`imageCount` or
 * `durationSeconds`).
 */
export const pushGenerationEstimates = <T extends { provider: string, model: string, totalCost: number }>(
  estimates: readonly T[],
  input: Pick<ComputeEstimatedCostsInput, 'applyCostMultipliers'>,
  rawMultiplierFor: (estimate: T) => number,
  step: EstimatedStepEntry['step'],
  extraFields: (estimate: T) => Partial<EstimatedStepEntry>
): CostStepsResult => {
  const steps: EstimatedStepEntry[] = []
  let cost = 0
  for (const estimate of estimates) {
    const costMultiplier = resolveCostMultiplier(input, rawMultiplierFor(estimate))
    const stepCost = applyCostMultiplier(estimate.totalCost, costMultiplier)
    cost += stepCost
    steps.push({
      step,
      provider: estimate.provider,
      model: estimate.model,
      cost: stepCost,
      costMultiplier,
      ...extraFields(estimate)
    })
  }
  return { steps, cost }
}
