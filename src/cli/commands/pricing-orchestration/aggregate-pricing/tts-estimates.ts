import type { TtsOptions, TtsStepEstimate, TtsTarget } from '~/types'
import { estimateTtsCosts, estimateTtsTargetCosts } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-pricing'
import { getTtsEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { applyCostMultiplier } from '~/cli/commands/pricing-orchestration/cost-helpers'

const buildTtsEstimatesFromCosts = async (
  opts: TtsOptions,
  costs: ReturnType<typeof estimateTtsTargetCosts>
): Promise<TtsStepEstimate[]> => {
  const estimates: TtsStepEstimate[] = []
  for (const cost of costs) {
    const estimation = getTtsEstimation(cost.provider, cost.model)
    estimates.push({
      step: 'tts' as const,
      provider: cost.provider,
      model: cost.model,
      ...(cost.costPerRequestCents !== undefined ? { costPerRequestCents: cost.costPerRequestCents } : {}),
      ...(cost.requestCount !== undefined ? { requestCount: cost.requestCount } : {}),
      ...(cost.costPer1kCharactersCents !== undefined ? { costPer1kCharactersCents: cost.costPer1kCharactersCents } : {}),
      ...(cost.inputCostPer1MCharactersCents !== undefined ? { inputCostPer1MCharactersCents: cost.inputCostPer1MCharactersCents } : {}),
      ...(cost.outputCostPer1MCharactersCents !== undefined ? { outputCostPer1MCharactersCents: cost.outputCostPer1MCharactersCents } : {}),
      characterCount: cost.characterCount,
      ...(cost.setupCostCents !== undefined ? { setupCostCents: cost.setupCostCents } : {}),
      ...(cost.setupTimeMs !== undefined ? { setupTimeMs: cost.setupTimeMs } : {}),
      ...(typeof opts.ttsChunkConcurrency === 'number' ? { chunkConcurrency: opts.ttsChunkConcurrency } : {}),
      totalCost: applyCostMultiplier(cost.totalCost - (cost.setupCostCents ?? 0), estimation.costMultiplier) + (cost.setupCostCents ?? 0),
      costMultiplier: estimation.costMultiplier,
      ...(cost.setupNote ? { note: cost.setupNote } : {}),
    })
  }
  return estimates
}

export const buildTtsTargetEstimates = async (
  targets: readonly TtsTarget[],
  opts: TtsOptions,
  characterCount: number
): Promise<TtsStepEstimate[]> => buildTtsEstimatesFromCosts(
  opts,
  estimateTtsTargetCosts(targets, Math.max(0, Math.floor(characterCount)))
)

export const buildTtsEstimates = async (
  opts: TtsOptions,
  characterCount: number
): Promise<TtsStepEstimate[]> => buildTtsEstimatesFromCosts(
  opts,
  estimateTtsCosts(opts, Math.max(0, Math.floor(characterCount)))
)
