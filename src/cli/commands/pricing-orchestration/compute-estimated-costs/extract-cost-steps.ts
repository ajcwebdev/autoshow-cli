import type { ComputeEstimatedCostsInput, CostStepsResult, EstimatedStepEntry } from '~/types'
import { resolveEstimatedExtractCostEntry } from '../provider-family-resolvers'

const resolveExtractTargets = (input: ComputeEstimatedCostsInput): NonNullable<ComputeEstimatedCostsInput['extractTargets']> => {
  if (input.extractTargets && input.extractTargets.length > 0) {
    return input.extractTargets
  }

  if (typeof input.extractPageCount !== 'number') {
    return []
  }

  const pageCount = input.extractPageCount
  const heuristicProviders = [
    { provider: 'glm' as const, model: input.glmOcrModels?.[0] },
    { provider: 'kimi' as const, model: input.kimiOcrModels?.[0] },
    { provider: 'openai' as const, model: input.openaiOcrModels?.[0] },
    { provider: 'grok' as const, model: input.grokOcrModels?.[0] },
    { provider: 'anthropic' as const, model: input.anthropicOcrModels?.[0] },
    { provider: 'gemini' as const, model: input.geminiOcrModels?.[0] },
    { provider: 'deepinfra' as const, model: input.deepinfraOcrModels?.[0] },
  ]

  return [
    ...(input.mistralOcrModels?.[0]
      ? [{ provider: 'mistral' as const, model: input.mistralOcrModels[0], pageCount, estimateType: 'exact' as const }]
      : []),
    ...(input.replicateOcrModels?.[0]
      ? [{ provider: 'replicate' as const, model: input.replicateOcrModels[0], pageCount, estimateType: 'exact' as const }]
      : []),
    ...(input.falOcrModels?.[0]
      ? [{ provider: 'fal' as const, model: input.falOcrModels[0], pageCount, estimateType: 'exact' as const }]
      : []),
    ...heuristicProviders.flatMap(({ provider, model }) =>
      model ? [{ provider, model, pageCount, estimateType: 'heuristic' as const }] : [])
  ]
}

export const buildExtractCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const steps: EstimatedStepEntry[] = []
  let cost = 0

  for (const target of resolveExtractTargets(input)) {
    const entry = resolveEstimatedExtractCostEntry(target, input)
    cost += entry.cost
    steps.push(entry)
  }

  return { steps, cost }
}
