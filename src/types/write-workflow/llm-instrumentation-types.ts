import type { Step3Metadata } from '~/types'

export type NormalizedLlmUsage = {
  inputTokenCount?: number | undefined
  outputTokenCount?: number | undefined
  totalTokenCount?: number | undefined
}

export type LlmApiCallResult = string | {
  text: string
  usage?: unknown
  rawProviderUsage?: unknown
  returnedModel?: string | undefined
}

export type LlmInstrumentationResult = {
  responseText: string
  inputTokenCount: number
  outputTokenCount: number
  processingTime: number
  tokenCountSource: NonNullable<Step3Metadata['tokenCountSource']>
  providerUsage?: NormalizedLlmUsage | undefined
  rawProviderUsage?: unknown
  providerReturnedModel?: string | undefined
}
