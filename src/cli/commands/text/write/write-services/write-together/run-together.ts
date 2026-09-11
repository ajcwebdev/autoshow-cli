import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { TOGETHER_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { UsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { resolveCredential } from '~/utils/validate/env-utils'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'
import { resolveLlmReasoningOptions } from '../llm-reasoning-options'

const TOGETHER_MODEL_BY_SELECTOR = {
  'kimi-k2.6': 'moonshotai/Kimi-K2.6',
  'glm-5.1': 'zai-org/GLM-5.1',
  'kimi-k3': 'moonshotai/Kimi-K3',
  'glm-5.3': 'zai-org/GLM-5.3',
  'glm-5.3-flash': 'zai-org/GLM-5.3-Flash'
} as const

const ensureTogetherApiKey = (): string => {
  const apiKey = resolveCredential('together', 'require', { stage: 'write:together', description: '--together models' })
  return apiKey
}

const resolveTogetherApiModel = (model: string): string => {
  if (!(model in TOGETHER_MODEL_BY_SELECTOR)) {
    throw UsageError(`Unsupported Together model selector "${model}". Allowed values: ${Object.keys(TOGETHER_MODEL_BY_SELECTOR).join(', ')}`)
  }

  return TOGETHER_MODEL_BY_SELECTOR[model as keyof typeof TOGETHER_MODEL_BY_SELECTOR]
}

export const runTogetherModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const { policy, updatedOpts } = resolveLlmReasoningOptions('together', model, structuredOpts)

  const result = await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts: updatedOpts,
    config: () => ({
      apiKey: ensureTogetherApiKey(),
      baseURL: TOGETHER_DEFAULT_BASE_URL,
      provider: 'together'
    }),
    service: 'together',
    providerLabel: 'Together',
    operationName: 'together-llm',
    customizeRequestBody: (requestBody, currentModel) => {
      requestBody['model'] = resolveTogetherApiModel(currentModel)
      requestBody['stream'] = false
      // K3's hosted quickstart budgets 131072 tokens for reasoning plus content.
      // Other models retain AutoShow's 32768-token cap, not a host maximum.
      requestBody['max_tokens'] = currentModel === 'kimi-k3' ? 131072 : 32768
      if (policy.effective === 'disabled') {
        requestBody['reasoning'] = { enabled: false }
      } else if (policy.effective === 'low' || policy.effective === 'high' || policy.effective === 'max') {
        requestBody['reasoning_effort'] = policy.effective
      }
    }
  })

  // Together can return cache hits at the top level instead of prompt_tokens_details.
  const usage = result.metadata.rawProviderUsage
  const normalized = result.metadata.providerUsage
  const cached = isRecord(usage) ? usage['cached_tokens'] : undefined
  if (normalized && normalized.cachedInputTokenCount === undefined
    && typeof cached === 'number' && Number.isFinite(cached) && cached >= 0
    && normalized.inputTokenCount !== undefined && cached <= normalized.inputTokenCount) {
    normalized.cachedInputTokenCount = cached
  }
  return result
}
