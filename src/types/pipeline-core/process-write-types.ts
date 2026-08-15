export type Step3Metadata = {
  llmService: 'openai' | 'groq' | 'gemini' | 'anthropic' | 'minimax' | 'grok' | 'glm' | 'kimi' | 'together' | 'cerebras'
  llmModel: string
  providerReturnedModel?: string | undefined
  processingTime: number
  inputTokenCount: number
  outputTokenCount: number
  tokenCountSource?: 'provider_usage' | 'local_count' | undefined
  providerUsage?: {
    inputTokenCount?: number | undefined
    outputTokenCount?: number | undefined
    totalTokenCount?: number | undefined
  } | undefined
  rawProviderUsage?: unknown
  outputFileName: string
  outputFormat: 'json'
  structuredMode: 'native' | 'schema-guided'
  structuredPresetNames: string[]
  validationFailed?: boolean | undefined
  requestedReasoningEffort?: import('~/cli/commands/setup-and-utilities/models/reasoning-resolver').NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: import('~/cli/commands/setup-and-utilities/models/reasoning-resolver').NormalizedReasoningEffort | undefined
  hostedConcurrency?: import('~/types').HostedConcurrencyTelemetry | undefined
}
