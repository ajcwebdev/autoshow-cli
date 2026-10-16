import { findRegistryServiceForModel, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { computeTokenCost } from '~/utils/pricing/token-pricing'

export const estimateLlmCostFromRegistry = (
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number => {
  const service = findRegistryServiceForModel('llm', modelId)
  if (!service) {
    return 0
  }

  const model = getModelRegistry().llm[service]?.models[modelId]
  if (!model) {
    return 0
  }

  return computeTokenCost(model, inputTokens, outputTokens).totalCost / 100
}
