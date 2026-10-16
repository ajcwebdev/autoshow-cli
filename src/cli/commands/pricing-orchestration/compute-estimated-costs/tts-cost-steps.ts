import { estimateSonioxTtsCost } from '~/cli/commands/audio/tts/tts-services/tts-soniox/soniox-tts-pricing'
import { estimateGeminiTtsCost } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-pricing'
import { estimateOpenAITtsCost, readOpenAITtsEstimate } from '~/cli/commands/audio/tts/tts-services/tts-openai/openai-tts-pricing'
import { OPENAI_TOKEN_TTS_MODEL } from '~/cli/commands/audio/tts/tts-services/tts-openai/openai-tts-request'
import { getTtsCost, getTtsEstimation, getTtsPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ComputeEstimatedCostsInput, CostStepsResult, EstimatedStepEntry } from '~/types'
import { applyCostMultiplier, computeTtsCost } from '../cost-helpers'
import { resolveCostMultiplier } from './cost-steps-shared'

export const buildTtsCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const steps: EstimatedStepEntry[] = []
  let cost = 0

  for (const ttsTarget of input.ttsTargets ?? []) {
    const resolvedTtsCharacterCount = typeof input.ttsCharacterCount === 'number' ? input.ttsCharacterCount : 0
    if (ttsTarget.service === 'gemini' || ttsTarget.service === 'soniox' || ttsTarget.service === 'openai' && ttsTarget.model === OPENAI_TOKEN_TTS_MODEL) {
      const estimate = ttsTarget.service === 'openai' ? readOpenAITtsEstimate(ttsTarget.openaiTtsEstimate) ?? estimateOpenAITtsCost(resolvedTtsCharacterCount, { instructions: ttsTarget.instructions, speed: ttsTarget.numericSpeed }) : ttsTarget.service === 'soniox' ? estimateSonioxTtsCost(resolvedTtsCharacterCount, ttsTarget.numericSpeed) : estimateGeminiTtsCost(ttsTarget.model, resolvedTtsCharacterCount)
      const total = estimate.totalCost + (ttsTarget.setupCostCents ?? 0)
      cost += total
      steps.push({ ...estimate, step: 'tts', provider: ttsTarget.service, model: ttsTarget.model, cost: total, estimatedInputTokens: estimate.estimatedTextTokens, estimatedOutputTokens: estimate.estimatedAudioTokens, inputCostPer1MCents: estimate.inputCostPer1MTokensCents, outputCostPer1MCents: estimate.outputCostPer1MAudioTokensCents, estimateType: 'heuristic', pricingBand: estimate.rateIdentity, pricingNote: estimate.estimateProvenance, ...(ttsTarget.setupCostCents !== undefined ? { setupCostCents: ttsTarget.setupCostCents } : {}) })
      continue
    }
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
      ...(ttsCost.costPerRequestCents !== undefined ? { costPerRequestCents: ttsCost.costPerRequestCents } : {}),
      ...(ttsCost.requestCount !== undefined ? { requestCount: ttsCost.requestCount } : {}),
      ...(costPer1kCharsCents !== undefined ? { costPer1kCharactersCents: costPer1kCharsCents } : {}),
      ...(pricing.inputCostPer1MCharsCents !== undefined ? { inputCostPer1MCharactersCents: pricing.inputCostPer1MCharsCents } : {}),
      ...(pricing.outputCostPer1MCharsCents !== undefined ? { outputCostPer1MCharactersCents: pricing.outputCostPer1MCharsCents } : {})
    })
  }

  return { steps, cost }
}
