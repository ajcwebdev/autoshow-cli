import { findRegistryServiceForModel, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'

// Single LLM pricing path for comic, sourced from the central model registry
// (llm-config.json) instead of comic-local pricing tables.
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

  return (
    (inputTokens / 1_000_000) * model.inputCostPer1MUSD +
    (outputTokens / 1_000_000) * model.outputCostPer1MUSD
  )
}
