import { requireApiKey } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'
import { resolveLlmReasoningOptions } from '../llm-reasoning-options'

const getGrokClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = requireApiKey('XAI_API_KEY', 'write:grok', '--grok models')

  return {
    apiKey,
    baseURL: XAI_DEFAULT_BASE_URL
  }
}

export const runGrokModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const { policy, updatedOpts } = resolveLlmReasoningOptions('grok', model, structuredOpts)

  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts: updatedOpts,
    config: getGrokClientConfig,
    service: 'grok',
    providerLabel: 'Grok',
    operationName: 'grok-llm',
    customizeRequestBody: (requestBody) => {
      if (policy.effective === 'low' || policy.effective === 'medium' || policy.effective === 'high') {
        requestBody['reasoning_effort'] = policy.effective
      }
    }
  })
}
