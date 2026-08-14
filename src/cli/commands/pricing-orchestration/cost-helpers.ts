import {
  estimateTtsRequestCount,
  getTtsCost,
  getTtsPricing
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeBilledSttCost } from './stt-billing'
export { applyCostMultiplier } from '~/utils/pricing/cost-multiplier'

export const parseDurationToSeconds = (duration: string): number => {
  if (!duration || duration === 'Unknown') return 0
  const parts = duration.split(':').map(Number)
  if (parts.length === 3) return (parts[0]! * 3600) + (parts[1]! * 60) + parts[2]!
  if (parts.length === 2) return (parts[0]! * 60) + parts[1]!
  return 0
}

export const computeTtsCost = (
  service: string,
  model: string,
  characterCount: number
): {
  cost: number
  costPerRequestCents?: number
  requestCount?: number
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
} => {
  const pricing = getTtsPricing(service, model)
  if (pricing.costPerRequestCents !== undefined) {
    const requestCount = estimateTtsRequestCount(service, model, characterCount)
    return {
      cost: requestCount * pricing.costPerRequestCents,
      costPerRequestCents: pricing.costPerRequestCents,
      requestCount
    }
  }
  if (
    pricing.inputCostPer1MCharsCents !== undefined
    && pricing.outputCostPer1MCharsCents !== undefined
  ) {
    return {
      cost: (characterCount / 1e6) * (pricing.inputCostPer1MCharsCents + pricing.outputCostPer1MCharsCents),
      inputCostPer1MCharactersCents: pricing.inputCostPer1MCharsCents,
      outputCostPer1MCharactersCents: pricing.outputCostPer1MCharsCents
    }
  }

  const costPer1kCharactersCents = pricing.costPer1kCharsCents ?? getTtsCost(service, model)
  return {
    cost: (characterCount / 1000) * costPer1kCharactersCents,
    costPer1kCharactersCents
  }
}

export const computeSttCost = (service: string, model: string, durationSeconds: number): number =>
  computeBilledSttCost(service, model, durationSeconds).cost
