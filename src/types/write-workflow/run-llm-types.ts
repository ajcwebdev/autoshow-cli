import type { HostedConcurrencyRuntimeOptions, LLMTarget, ResolvedStructuredSchema, StructuredRunResult, StructuredValidationContext } from '~/types'
import type { NormalizedReasoningEffort } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

export type PendingStructuredRunResult = StructuredRunResult & {
  fileName: string
}

export type RunLlmTargetsForStructuredPromptOptions = HostedConcurrencyRuntimeOptions & {
  prompt: string
  outputDir: string
  targets: LLMTarget[]
  structuredSchema: ResolvedStructuredSchema
  structuredValidationContext: StructuredValidationContext
  llmProviderConcurrency?: number | undefined
  llmLocalConcurrency?: number | undefined
  reasoningEffort?: NormalizedReasoningEffort | undefined
  fileNameForTarget?: ((target: LLMTarget, index: number, defaultFileName: string) => string) | undefined
}
