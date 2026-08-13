import { requireApiKey } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

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
  const policy = resolveReasoningPolicy({
    step: 'llm',
    service: 'grok',
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
