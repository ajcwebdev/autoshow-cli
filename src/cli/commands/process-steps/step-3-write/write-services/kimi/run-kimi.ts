import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { acceptsKimiThinkingField, ensureKimiApiKey, resolveKimiBaseUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/kimi-ocr/kimi'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'

export const runKimiModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts,
    config: () => ({
      apiKey: ensureKimiApiKey('--kimi models'),
      baseURL: resolveKimiBaseUrl()
    }),
    service: 'kimi',
    providerLabel: 'Kimi',
    operationName: 'kimi-llm',
    customizeRequestBody: (requestBody) => {
      requestBody['stream'] = false
      requestBody['max_completion_tokens'] = 32768
      if (acceptsKimiThinkingField(model)) {
        requestBody['thinking'] = { type: 'disabled' }
      }
    },
    buildStructuredResponseFormat: () => ({ type: 'json_object' })
  })
}
