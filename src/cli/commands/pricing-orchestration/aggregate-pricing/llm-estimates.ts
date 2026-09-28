import type { LlmStepEstimate, NormalizedReasoningEffort, ResolvedLLMModelOptions } from '~/types'
import { resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { estimateLlmRates } from '~/cli/commands/text/write/write-utils/llm-pricing'
import { estimatePromptTokensFromText, readPromptFile } from '~/cli/commands/text/write/text-input-utils'
import { getLlmCost, getLlmEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { resolvePromptNames, resolvePromptTokenEstimate } from '~/prompts/prompt-loader'
import { computeTokenCost } from '~/utils/pricing/token-pricing'

export const buildLlmEstimates = async (
  opts: Partial<ResolvedLLMModelOptions> & {
    prompts?: string[] | undefined
    promptFile?: string | undefined
    reasoningEffort?: NormalizedReasoningEffort | undefined
  },
  inputText?: string
): Promise<LlmStepEstimate[]> => {
  const llmConfig = resolveLLMDefaults(opts)
  const rates = estimateLlmRates(llmConfig)
  const plannedRates = rates.map((rate) => {
    const registryService = rate.provider
    const requestedReasoningEffort = opts.reasoningEffort
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
  const promptFile = await readPromptFile(opts.promptFile)
  const promptFileText = promptFile?.kind === 'leaf'
    ? [promptFile.leaf.instruction.trim(), promptFile.leaf.examples.json.trim()].filter(Boolean).join('\n\n')
    : promptFile?.text
  const extraPromptTokens = promptFileText ? estimatePromptTokensFromText(promptFileText) : 0
  const leafInputTokens = promptFile?.kind === 'leaf' ? promptFile.leaf.expectedInputTokens : 0
  const leafOutputTokens = promptFile?.kind === 'leaf' ? promptFile.leaf.expectedOutputTokens : 0
  const inputTokens = inputText === undefined ? undefined : estimatePromptTokensFromText(inputText)
  const namedInstructionTokens = inputTokens === undefined ? 0 : estimatePromptTokensFromText(await resolvePromptNames(prompts, {
    exampleFormat: 'json',
    fallbackToDefault: !promptFileOnly
  }))
  // A freeform prompt has no declared response length. Use a visible heuristic
  // instead of silently pricing a response of zero tokens.
  const freeformOutputTokens = promptFileOnly && promptFile?.kind === 'text'
    ? Math.max(1024, inputTokens ?? promptTokenEstimate.estimatedInputTokens)
    : 0

  return plannedRates.map(({ rate: r, registryService, reasoningPolicy }) => {
    const estimation = getLlmEstimation(registryService, r.model)
    const estimatedInputTokens = (inputTokens === undefined
      ? promptTokenEstimate.estimatedInputTokens + leafInputTokens
      : inputTokens + namedInstructionTokens) + extraPromptTokens
    const estimatedOutputTokens = promptTokenEstimate.estimatedOutputTokens + leafOutputTokens + freeformOutputTokens
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
      ...((typeof cost.pricingNote === 'string' || freeformOutputTokens > 0)
        ? { pricingNote: [cost.pricingNote, freeformOutputTokens > 0 ? 'Freeform output estimate: at least 1,024 tokens or the input document token estimate, whichever is larger; actual output and reasoning usage may differ.' : undefined].filter(Boolean).join(' ') }
        : {})
    }
  })
}
