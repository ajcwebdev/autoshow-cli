import { getTtsCost, getTtsPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { TtsCostEstimate, TtsOptions, TtsRateEstimate, TtsTarget } from '~/types'
import { collectTtsTargets } from '../tts-targets'

export const estimateTtsTargetCosts = (
  targets: readonly TtsTarget[],
  characterCount: number
): TtsCostEstimate[] => {
  const normalizedCharCount = Math.max(0, Math.floor(characterCount))
  return targets.map((target) => {
    const pricing = getTtsPricing(target.service, target.model)
    const hasDualRates = pricing.inputCostPer1MCharsCents !== undefined && pricing.outputCostPer1MCharsCents !== undefined
    const rate: TtsRateEstimate = hasDualRates
      ? {
          provider: target.service,
          model: target.model,
          inputCostPer1MCharactersCents: pricing.inputCostPer1MCharsCents as number,
          outputCostPer1MCharactersCents: pricing.outputCostPer1MCharsCents as number
        }
      : {
          provider: target.service,
          model: target.model,
          costPer1kCharactersCents: pricing.costPer1kCharsCents ?? getTtsCost(target.service, target.model)
        }
    const dualRateTotal = (
      rate.inputCostPer1MCharactersCents !== undefined
      && rate.outputCostPer1MCharactersCents !== undefined
    )
      ? (normalizedCharCount / 1e6) * (rate.inputCostPer1MCharactersCents + rate.outputCostPer1MCharactersCents)
      : undefined
    const per1kTotal = rate.costPer1kCharactersCents !== undefined
      ? (normalizedCharCount / 1000) * rate.costPer1kCharactersCents
      : undefined
    const synthesisCost = dualRateTotal ?? per1kTotal ?? 0
    const setupCost = target.setupCostCents ?? 0

    return {
      provider: rate.provider,
      model: rate.model,
      characterCount: normalizedCharCount,
      ...(rate.costPer1kCharactersCents !== undefined ? { costPer1kCharactersCents: rate.costPer1kCharactersCents } : {}),
      ...(rate.inputCostPer1MCharactersCents !== undefined ? { inputCostPer1MCharactersCents: rate.inputCostPer1MCharactersCents } : {}),
      ...(rate.outputCostPer1MCharactersCents !== undefined ? { outputCostPer1MCharactersCents: rate.outputCostPer1MCharactersCents } : {}),
      ...(typeof target.setupCostCents === 'number' ? { setupCostCents: target.setupCostCents } : {}),
      ...(typeof target.setupTimeMs === 'number' ? { setupTimeMs: target.setupTimeMs } : {}),
      ...(typeof target.setupNote === 'string' ? { setupNote: target.setupNote } : {}),
      totalCost: synthesisCost + setupCost
    }
  })
}

export const estimateTtsCosts = (opts: TtsOptions, characterCount: number): TtsCostEstimate[] =>
  estimateTtsTargetCosts(collectTtsTargets(opts), characterCount)
