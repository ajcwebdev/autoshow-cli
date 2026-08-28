import type { DocumentMetadata, ExtractionOptions, HostedOcrSchedulerRetryPressureHandler, MappedReasoningPolicy, NormalizedReasoningEffort, OpenAIChatCompletionResponse, OpenAIRestConfig } from '~/types'

export type ChatImageOcrBodyInput = {
  model: string
  messages: Array<{
    role: 'user'
    content: Array<
      | { type: 'text', text: string }
      | { type: 'image_url', image_url: { url: string } }
    >
  }>
  reasoningPolicy: MappedReasoningPolicy
}

export type ChatImageOcrProfile<TExtractionMethod extends string> = {
  extractionMethod: TExtractionMethod
  service: string
  providerLabel: string
  maxImageBytes: number
  imageLimitLabel: string
  supportedMimeTypes: Partial<Record<DocumentMetadata['format'], string>>
  prompt: string
  errorMessagePrefix: string
  getConfig: (baseUrl?: string) => OpenAIRestConfig
  buildBody: (input: ChatImageOcrBodyInput) => Record<string, unknown>
  checkResponse?: ((response: OpenAIChatCompletionResponse, rawText: string, pageLabel: string) => void) | undefined
}

export type ChatImageOcrOptions = Pick<ExtractionOptions, 'dpi' | 'password' | 'outputDir' | 'ocrPreparationCache' | 'ocrConcurrency' | 'ocrConcurrencyMode' | 'hostedOcrScheduler'> & {
  onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
  documentPageNumber?: number | undefined
  reasoningEffort?: NormalizedReasoningEffort | undefined
}
