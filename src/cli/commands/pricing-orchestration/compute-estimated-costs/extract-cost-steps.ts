import type { ComputeEstimatedCostsInput, CostStepsResult, EstimatedStepEntry } from '~/types'
import { resolveEstimatedExtractCostEntry } from '../provider-family-resolvers'

export const buildExtractCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const steps: EstimatedStepEntry[] = []
  let cost = 0

  for (const target of input.extractTargets ?? []) {
    const entry = resolveEstimatedExtractCostEntry(target, input)
    cost += entry.cost
    steps.push(entry)
  }

  return { steps, cost }
}
