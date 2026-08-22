import type { ComputeEstimatedCostsInput, CostStepsResult, EstimatedStepEntry } from '~/types'
import { computeSttCost } from '../cost-helpers'
import { estimateSupadataCost } from '../supadata-pricing'
import { estimateScrapeCreatorsCost } from '~/utils/pricing/scrapecreators-pricing'
import { EXACT_COST_MULTIPLIER } from './cost-steps-shared'

const STT_FIELD_MAP = [
  { field: 'deepinfraSttModels' as const, provider: 'deepinfra' },
  { field: 'deepgramSttModels' as const, provider: 'deepgram' },
  { field: 'sonioxSttModels' as const, provider: 'soniox' },
  { field: 'speechmaticsSttModels' as const, provider: 'speechmatics' },
  { field: 'revSttModels' as const, provider: 'rev' },
  { field: 'groqSttModels' as const, provider: 'groq' },
  { field: 'grokSttModels' as const, provider: 'grok' },
  { field: 'mistralSttModels' as const, provider: 'mistral' },
  { field: 'assemblyaiSttModels' as const, provider: 'assemblyai' },
  { field: 'gladiaSttModels' as const, provider: 'gladia' },
  { field: 'happyscribeSttModels' as const, provider: 'happyscribe' },
  { field: 'supadataSttModels' as const, provider: 'supadata' },
  { field: 'scrapecreatorsSttModels' as const, provider: 'scrapecreators' },
  { field: 'geminiSttModels' as const, provider: 'gemini-stt' },
  { field: 'togetherSttModels' as const, provider: 'together' },
  { field: 'whisperModels' as const, provider: 'whisper' },
  { field: 'whisperfileModels' as const, provider: 'whisperfile' },
]

const computeSttTargetStep = (
  service: string,
  model: string,
  durationSeconds: number,
  input: Pick<ComputeEstimatedCostsInput, 'sourceUrl'>
): EstimatedStepEntry => {
  if (service === 'supadata') {
    const { totalCost } = estimateSupadataCost(model, durationSeconds, { sourceUrl: input.sourceUrl })
    return { step: 'stt', provider: service, model, cost: totalCost, costMultiplier: EXACT_COST_MULTIPLIER, durationSeconds }
  }

  if (service === 'scrapecreators') {
    const { totalCost } = estimateScrapeCreatorsCost()
    return { step: 'stt', provider: service, model, cost: totalCost, costMultiplier: EXACT_COST_MULTIPLIER, durationSeconds: 0 }
  }

  const cost = computeSttCost(service, model, durationSeconds)
  return { step: 'stt', provider: service, model, cost, costMultiplier: EXACT_COST_MULTIPLIER, durationSeconds }
}

export const buildSttCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const steps: EstimatedStepEntry[] = []
  let cost = 0
  const durationSeconds = input.audioDurationSeconds ?? 0

  const push = (entry: EstimatedStepEntry): void => {
    cost += entry.cost
    steps.push(entry)
  }

  const explicitSttTargets = input.sttTargets ?? []

  if (explicitSttTargets.length > 0) {
    for (const target of explicitSttTargets) {
      push(computeSttTargetStep(target.service, target.model, durationSeconds, input))
    }
  } else {
    for (const { field, provider } of STT_FIELD_MAP) {
      const models = input[field]
      const model = models?.[0]
      if (typeof model === 'string' && model.length > 0) {
        push(computeSttTargetStep(provider, model, durationSeconds, input))
        break
      }
    }
  }

  return { steps, cost }
}
