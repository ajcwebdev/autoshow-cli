import type { OpenAIChatCompletionResponse, OpenAIRestConfig, Step3Metadata, StructuredRequestOptions } from '~/types'

export type OpenAICompatibleChatService = Extract<Step3Metadata['llmService'], 'grok'>

export type RunOpenAICompatibleChatModelOptions = {
  prompt: string
  model: string
  structuredOpts?: StructuredRequestOptions | undefined
  config: OpenAIRestConfig | (() => OpenAIRestConfig)
  service: OpenAICompatibleChatService
  providerLabel: string
  operationName: string
  customizeRequestBody?: ((requestBody: Record<string, unknown>, model: string) => void) | undefined
  buildStructuredResponseFormat?: ((structuredOpts: StructuredRequestOptions) => Record<string, unknown>) | undefined
  mapUsage?: ((usage: OpenAIChatCompletionResponse['usage']) => OpenAIChatCompletionResponse['usage']) | undefined
  checkResponse?: ((response: OpenAIChatCompletionResponse) => void) | undefined
}
