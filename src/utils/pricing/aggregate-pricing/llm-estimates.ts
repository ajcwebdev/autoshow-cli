import type { LlmStepEstimate, ResolvedLLMModelOptions } from '~/types'
import { resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { estimateLlmRates } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-pricing'
import { estimatePromptTokensFromText, readPromptFileText } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { getLlmCost, getLlmEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveReasoningPolicy, type NormalizedReasoningEffort } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { resolvePromptTokenEstimate } from '~/prompts/prompt-loader'
import { computeTokenCost } from '~/utils/pricing/token-pricing'

export const buildLlmEstimates = async (
  opts: Partial<ResolvedLLMModelOptions> & {
    prompts?: string[] | undefined
    promptFile?: string | undefined
    reasoningEffort?: NormalizedReasoningEffort | undefined
  },
  skipLLM: boolean
): Promise<LlmStepEstimate[]> => {
  if (skipLLM) return []
  const llmConfig = resolveLLMDefaults(opts)
  const rates = estimateLlmRates(llmConfig)
  const plannedRates = rates.map((rate) => {
    const registryService = rate.provider === 'llama.cpp' ? 'llama' : rate.provider
    const requestedReasoningEffort = registryService === 'llama' || registryService === 'llamafile'
      ? undefined
      : opts.reasoningEffort
    return {
      rate,
      registryService,
      reasoningPolicy: resolveReasoningPolicy({
        step: 'llm',
        service: registryService,
        model: rate.model,
        requestedReasoningEffort
      })
    }
  })
  const prompts = opts.prompts ?? []
  const promptFileOnly = typeof opts.promptFile === 'string' && opts.promptFile.length > 0 && prompts.length === 0
  const promptTokenEstimate = await resolvePromptTokenEstimate(prompts, {
    fallbackToDefault: !promptFileOnly
  })
  const promptFileText = await readPromptFileText(opts.promptFile)
  const extraPromptTokens = promptFileText ? estimatePromptTokensFromText(promptFileText) : 0

  return plannedRates.map(({ rate: r, registryService, reasoningPolicy }) => {
    const estimation = getLlmEstimation(registryService, r.model)
    const estimatedInputTokens = promptTokenEstimate.estimatedInputTokens + extraPromptTokens
    const estimatedOutputTokens = promptTokenEstimate.estimatedOutputTokens
    const cost = computeTokenCost(
      getLlmCost(registryService, r.model) ?? r,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimation.costMultiplier
    )

    return {
      step: 'llm' as const,
      provider: r.provider,
      model: r.model,
      inputCostPer1MCents: cost.inputCostPer1MCents,
      outputCostPer1MCents: cost.outputCostPer1MCents,
      estimatedInputTokens,
      estimatedOutputTokens,
      ...(reasoningPolicy.requested !== undefined ? { requestedReasoningEffort: reasoningPolicy.requested } : {}),
      effectiveReasoningEffort: reasoningPolicy.effective,
      totalCost: cost.totalCost,
      costMultiplier: estimation.costMultiplier,
      ...(typeof cost.pricingBand === 'string' ? { pricingBand: cost.pricingBand } : {}),
      ...(typeof cost.pricingNote === 'string' ? { pricingNote: cost.pricingNote } : {})
    }
  })
}
