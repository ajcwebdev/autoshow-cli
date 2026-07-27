import { estimateLlmCostFromRegistry } from './llm-cost'
import type { ComicLlmResponseUsage, LlmModel } from '~/types'

export const calculateCost = (model: LlmModel, usage: ComicLlmResponseUsage): number =>
  estimateLlmCostFromRegistry(model, usage.input_tokens, usage.output_tokens)
