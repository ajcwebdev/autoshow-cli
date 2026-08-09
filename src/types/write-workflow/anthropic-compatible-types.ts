import type { AnthropicRestConfig, Step3Metadata, StructuredRequestOptions } from '~/types'

export type AnthropicCompatibleService = Extract<Step3Metadata['llmService'], 'anthropic'>

export type RunAnthropicCompatibleModelOptions = {
  prompt: string
  model: string
  structuredOpts?: StructuredRequestOptions | undefined
  config: AnthropicRestConfig | (() => AnthropicRestConfig)
  service: AnthropicCompatibleService
  providerLabel: string
  operationName: string
  supportsStructuredOutput?: boolean
}
