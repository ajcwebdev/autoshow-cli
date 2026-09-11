import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { ensureGlmApiKey, resolveGlmBaseUrl } from '~/cli/commands/text/ocr/ocr-services/glm-ocr/glm'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'
import { resolveLlmReasoningOptions } from '../llm-reasoning-options'

export const runGlmModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const { policy, updatedOpts } = resolveLlmReasoningOptions('glm', model, structuredOpts)

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
      if (model === 'glm-5.3' || model === 'glm-5.3-flash') {
        requestBody['thinking'] = { type: 'enabled' }
        if (policy.effective === 'low' || policy.effective === 'high' || policy.effective === 'max') {
          requestBody['reasoning_effort'] = policy.effective
        }
      } else if (policy.effective === 'disabled') {
        requestBody['thinking'] = { type: 'disabled' }
      }
    },
    buildStructuredResponseFormat: () => ({ type: 'json_object' })
  })
}
