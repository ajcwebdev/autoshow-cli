import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { ensureGlmApiKey, resolveGlmBaseUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/glm-ocr/glm'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

export const runGlmModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const policy = resolveReasoningPolicy({
    step: 'llm',
    service: 'glm',
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
      apiKey: ensureGlmApiKey('--glm models', 'write:glm'),
      baseURL: resolveGlmBaseUrl()
    }),
    service: 'glm',
    providerLabel: 'GLM',
    operationName: 'glm-llm',
    customizeRequestBody: (requestBody) => {
      requestBody['stream'] = false
      requestBody['max_tokens'] = 16000
      if (policy.effective === 'disabled') {
        requestBody['thinking'] = { type: 'disabled' }
      }
    },
    buildStructuredResponseFormat: () => ({ type: 'json_object' })
  })
}
