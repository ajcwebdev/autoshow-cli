import type { LLMTarget, ResolvedStructuredSchema, StructuredRunResult, StructuredValidationContext } from '~/types'

export type PendingStructuredRunResult = StructuredRunResult & {
  fileName: string
}

export type RunLlmTargetsForStructuredPromptOptions = {
  prompt: string
  outputDir: string
  targets: LLMTarget[]
  structuredSchema: ResolvedStructuredSchema
  structuredValidationContext: StructuredValidationContext
  llmProviderConcurrency?: number | undefined
  llmLocalConcurrency?: number | undefined
  fileNameForTarget?: ((target: LLMTarget, index: number, defaultFileName: string) => string) | undefined
}
