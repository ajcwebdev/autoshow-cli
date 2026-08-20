import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { ensureKimiApiKey, resolveKimiBaseUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/kimi-ocr/kimi'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'
import { resolveLlmReasoningOptions } from '../llm-reasoning-options'

export const runKimiModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const { policy, updatedOpts } = resolveLlmReasoningOptions('kimi', model, structuredOpts)

  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts: updatedOpts,
    config: () => ({
      apiKey: ensureKimiApiKey('--kimi models', 'write:kimi'),
      baseURL: resolveKimiBaseUrl()
    }),
    service: 'kimi',
    providerLabel: 'Kimi',
    operationName: 'kimi-llm',
    customizeRequestBody: (requestBody) => {
      requestBody['stream'] = false
      requestBody['max_completion_tokens'] = 32768
      if (policy.effective === 'disabled') {
        requestBody['thinking'] = { type: 'disabled' }
      } else if (model === 'kimi-k3' && policy.requested !== undefined && policy.requested !== 'default') {
        requestBody['reasoning_effort'] = policy.effective
      }
    },
    buildStructuredResponseFormat: () => ({ type: 'json_object' })
  })
}
