import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { TOGETHER_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { UsageError } from '~/utils/error-handler'
import { requireProviderKey } from '~/utils/validate/env-utils'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'
import { resolveLlmReasoningOptions } from '../llm-reasoning-options'

const TOGETHER_MODEL_BY_SELECTOR = {
  'kimi-k2.6': 'moonshotai/Kimi-K2.6',
  'glm-5.1': 'zai-org/GLM-5.1'
} as const

const ensureTogetherApiKey = (): string => {
  const apiKey = requireProviderKey('together', 'write:together', '--together models')
  return apiKey
}

const resolveTogetherApiModel = (model: string): string => {
  if (!(model in TOGETHER_MODEL_BY_SELECTOR)) {
    throw UsageError(`Unsupported Together model selector "${model}". Allowed values: kimi-k2.6, glm-5.1`)
  }

  return TOGETHER_MODEL_BY_SELECTOR[model as keyof typeof TOGETHER_MODEL_BY_SELECTOR]
}

export const runTogetherModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const { policy, updatedOpts } = resolveLlmReasoningOptions('together', model, structuredOpts)

  return await runOpenAICompatibleChatModel({
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
      requestBody['max_tokens'] = 32768
      if (policy.effective === 'disabled') {
        requestBody['reasoning'] = { enabled: false }
      }
    }
  })
}
