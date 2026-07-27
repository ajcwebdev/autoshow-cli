import type { OpenAIRestConfig, Step3Metadata, StructuredRequestOptions } from '~/types'

export type OpenAICompatibleChatService = Extract<Step3Metadata['llmService'], 'groq' | 'grok' | 'glm' | 'kimi' | 'together' | 'cerebras'>

export type RunOpenAICompatibleChatModelOptions = {
  prompt: string
  model: string
  structuredOpts?: StructuredRequestOptions | undefined
  config: OpenAIRestConfig
  service: OpenAICompatibleChatService
  providerLabel: string
  operationName: string
  customizeRequestBody?: ((requestBody: Record<string, unknown>, model: string) => void) | undefined
  buildStructuredResponseFormat?: ((structuredOpts: StructuredRequestOptions) => Record<string, unknown>) | undefined
}
