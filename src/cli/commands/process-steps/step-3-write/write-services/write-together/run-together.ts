import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { TOGETHER_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { CLIUsageError } from '~/utils/error-handler'
import { requireApiKey } from '~/utils/validate/env-utils'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

export const TOGETHER_MODEL_BY_SELECTOR = {
  'kimi-k2.6': 'moonshotai/Kimi-K2.6',
  'glm-5.1': 'zai-org/GLM-5.1'
} as const

const ensureTogetherApiKey = (): string => {
  const apiKey = requireApiKey('TOGETHER_API_KEY', 'write:together', '--together models')
  return apiKey
}

export const resolveTogetherApiModel = (model: string): string => {
  if (!(model in TOGETHER_MODEL_BY_SELECTOR)) {
    throw CLIUsageError(`Unsupported Together model selector "${model}". Allowed values: kimi-k2.6, glm-5.1`)
  }

  return TOGETHER_MODEL_BY_SELECTOR[model as keyof typeof TOGETHER_MODEL_BY_SELECTOR]
}

export const runTogetherModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const policy = resolveReasoningPolicy({
    step: 'llm',
    service: 'together',
    model,
    requestedReasoningEffort: structuredOpts?.requestedReasoningEffort
  })
  const updatedOpts: StructuredRequestOptions | undefined = structuredOpts
    ? { ...structuredOpts, requestedReasoningEffort: policy.requested, effectiveReasoningEffort: policy.effective }
    : {
        schemaName: '',
        schema: {},
        strict: false,
        strategy: 'native',
        requestedReasoningEffort: policy.requested,
        effectiveReasoningEffort: policy.effective
      }

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
