import type { ComputeEstimatedCostsInput, CostStepsResult, EstimatedStepEntry } from '~/types'
import { computeSttCost } from '../cost-helpers'
import { estimateSupadataCost } from '../supadata-pricing'
import { estimateScrapeCreatorsCost } from '~/utils/pricing/scrapecreators-pricing'
import { EXACT_COST_MULTIPLIER } from './cost-steps-shared'

const computeSttTargetStep = (
  service: string,
  model: string,
  durationSeconds: number,
  input: Pick<ComputeEstimatedCostsInput, 'sourceUrl'>,
  diarizationOptions?: import('~/types').DiarizationOptions
): EstimatedStepEntry => {
  if (service === 'supadata') {
    const { totalCost } = estimateSupadataCost(model, durationSeconds, { sourceUrl: input.sourceUrl })
    return { step: 'stt', provider: service, model, cost: totalCost, costMultiplier: EXACT_COST_MULTIPLIER, durationSeconds }
  }

  if (service === 'scrapecreators') {
    const { totalCost } = estimateScrapeCreatorsCost()
    return { step: 'stt', provider: service, model, cost: totalCost, costMultiplier: EXACT_COST_MULTIPLIER, durationSeconds: 0 }
  }

  const cost = computeSttCost(service, model, durationSeconds, diarizationOptions)
  return { step: 'stt', provider: service, model, cost, costMultiplier: EXACT_COST_MULTIPLIER, durationSeconds }
}

export const buildSttCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const steps: EstimatedStepEntry[] = []
  let cost = 0
  const durationSeconds = input.audioDurationSeconds ?? 0

  for (const target of input.sttTargets ?? []) {
    const entry = computeSttTargetStep(target.service, target.model, durationSeconds, input, target.diarizationOptions)
    cost += entry.cost
    steps.push(entry)
  }

  return { steps, cost }
}
