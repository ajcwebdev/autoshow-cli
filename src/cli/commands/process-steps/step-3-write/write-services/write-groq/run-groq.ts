import { requireApiKey } from '~/utils/validate/env-utils'
import { GROQ_DEFAULT_BASE_URL } from '~/utils/base-urls'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

const getGroqClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = requireApiKey('GROQ_API_KEY', 'write:groq', '--groq models')

  return { apiKey, baseURL: GROQ_DEFAULT_BASE_URL }
}

export const runGroqModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const policy = resolveReasoningPolicy({
    step: 'llm',
    service: 'groq',
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
    config: getGroqClientConfig,
    service: 'groq',
    providerLabel: 'Groq',
    operationName: 'groq-llm',
    customizeRequestBody: (requestBody) => {
      if (policy.effective === 'low' || policy.effective === 'medium' || policy.effective === 'high') {
        requestBody['reasoning_effort'] = policy.effective
      }
    }
  })
}
