import type { ComputeEstimatedCostsInput, CostStepsResult, EstimatedStepEntry } from '~/types'
import { computeSttCost } from '../cost-helpers'
import { estimateSupadataCost } from '../supadata-pricing'
import { estimateScrapeCreatorsCost } from '../scrapecreators-pricing'
import { EXACT_COST_MULTIPLIER } from './cost-steps-shared'

const STT_FIELD_MAP = [
  { field: 'deepinfraSttModel' as const, provider: 'deepinfra' },
  { field: 'deepgramSttModel' as const, provider: 'deepgram' },
  { field: 'sonioxSttModel' as const, provider: 'soniox' },
  { field: 'speechmaticsSttModel' as const, provider: 'speechmatics' },
  { field: 'revSttModel' as const, provider: 'rev' },
  { field: 'groqSttModel' as const, provider: 'groq' },
  { field: 'grokSttModel' as const, provider: 'grok' },
  { field: 'mistralSttModel' as const, provider: 'mistral' },
  { field: 'assemblyaiSttModel' as const, provider: 'assemblyai' },
  { field: 'gladiaSttModel' as const, provider: 'gladia' },
  { field: 'happyscribeSttModel' as const, provider: 'happyscribe' },
  { field: 'supadataSttModel' as const, provider: 'supadata' },
  { field: 'scrapecreatorsSttModel' as const, provider: 'scrapecreators' },
  { field: 'geminiSttModel' as const, provider: 'gemini-stt' },
  { field: 'togetherSttModel' as const, provider: 'together' },
  { field: 'whisperModel' as const, provider: 'whisper' },
]

/**
 * Resolve a single STT step entry, unifying the reverb/supadata/scrapecreators special
 * cases that were previously duplicated across the explicit-targets path and the
 * STT_FIELD_MAP fallback scan.
 */
const computeSttTargetStep = (
  service: string,
  model: string,
  durationSeconds: number,
  input: Pick<ComputeEstimatedCostsInput, 'sourceUrl'>
): EstimatedStepEntry => {
  if (service === 'reverb') {
    return { step: 'stt', provider: 'reverb', model: 'reverb', cost: 0, costMultiplier: 1, durationSeconds }
  }

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
  } else if (input.useReverb) {
    push({ step: 'stt', provider: 'reverb', model: 'reverb', cost: 0, costMultiplier: 1, durationSeconds })
  } else {
    for (const { field, provider } of STT_FIELD_MAP) {
      const model = input[field]
      if (typeof model === 'string' && model.length > 0) {
        push(computeSttTargetStep(provider, model, durationSeconds, input))
        break
      }
    }
  }

  return { steps, cost }
}
