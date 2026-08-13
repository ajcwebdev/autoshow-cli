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
    { provider: 'glm' as const, model: input.glmOcrModel },
    { provider: 'kimi' as const, model: input.kimiOcrModel },
    { provider: 'openai' as const, model: input.openaiOcrModel },
    { provider: 'grok' as const, model: input.grokOcrModel },
    { provider: 'anthropic' as const, model: input.anthropicOcrModel },
    { provider: 'gemini' as const, model: input.geminiOcrModel },
    { provider: 'deepinfra' as const, model: input.deepinfraOcrModel },
  ]

  return [
    ...(input.mistralOcrModel
      ? [{ provider: 'mistral' as const, model: input.mistralOcrModel, pageCount, estimateType: 'exact' as const }]
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
