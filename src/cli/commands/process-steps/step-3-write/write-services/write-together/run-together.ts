import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { TOGETHER_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { CLIUsageError, InternalError, hintsForMissingEnv } from '~/utils/error-handler'
import { readEnv } from '~/utils/validate/env-utils'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'

export const TOGETHER_MODEL_BY_SELECTOR = {
  'kimi-k2.6': 'moonshotai/Kimi-K2.6',
  'glm-5.1': 'zai-org/GLM-5.1'
} as const

const ensureTogetherApiKey = (): string => {
  const apiKey = readEnv('TOGETHER_API_KEY')
  if (!apiKey) {
    throw InternalError('TOGETHER_API_KEY environment variable is required for --together models', { stage: 'write:together', hints: hintsForMissingEnv('TOGETHER_API_KEY') })
  }
  return apiKey
}

const resolveTogetherBaseUrl = (baseUrl: string = TOGETHER_DEFAULT_BASE_URL): string =>
  baseUrl.trim().replace(/\/+$/, '')

export const resolveTogetherApiModel = (model: string): string => {
  if (!(model in TOGETHER_MODEL_BY_SELECTOR)) {
    throw CLIUsageError(`Unsupported Together model selector "${model}". Allowed values: kimi-k2.6, glm-5.1`)
  }

  return TOGETHER_MODEL_BY_SELECTOR[model as keyof typeof TOGETHER_MODEL_BY_SELECTOR]
}

export const runTogetherModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions,
  baseUrl?: string
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const config = {
    apiKey: ensureTogetherApiKey(),
    baseURL: resolveTogetherBaseUrl(baseUrl),
    provider: 'together'
  }

  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts,
    config,
    service: 'together',
    providerLabel: 'Together',
    operationName: 'together-llm',
    customizeRequestBody: (requestBody, currentModel) => {
      requestBody['model'] = resolveTogetherApiModel(currentModel)
      requestBody['stream'] = false
      requestBody['max_tokens'] = 32768
    }
  })
}
