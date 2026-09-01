import type { BatchRuntimeOptions, HostedConcurrencyCoordinator, HostedConcurrencyMode, HostedTtsChunkScheduler, HtmlArticleBackend, ImageRuntimeOptions, MusicRuntimeOptions, NormalizedReasoningEffort, OcrRuntimeOptions, OcrSelectionOptions, ResolvedLLMModelOptions, ResourceGate, SttRuntimeOptions, SttSelectionOptions, TtsRuntimeOptions, VideoRuntimeOptions } from '~/types'

export const PROCESS_COMMANDS = ['metadata', 'download', 'extract', 'write', 'tts', 'image', 'video', 'music', 'comic'] as const

export type ProcessCommand = typeof PROCESS_COMMANDS[number]

export const OUTPUT_FORMATS = ['text', 'json'] as const
export type OutputFormat = typeof OUTPUT_FORMATS[number]

export type Step2ProviderSelectionOrigin = 'default' | 'explicit' | 'all-shortcut'

export type SharedPipelineOptions = {
  concurrencyMode: HostedConcurrencyMode
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
  outputRootDir: string
  configPath: string | undefined
  youtubeCaptions: boolean
  whisperExplicit: boolean
  step2SelectionOrigins: Partial<Record<string, Step2ProviderSelectionOrigin>>
}

export type HostedConcurrencyRuntimeOptions = {
  concurrencyMode?: HostedConcurrencyMode | undefined
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
}

export type LlmRuntimeOptions = ResolvedLLMModelOptions & HostedConcurrencyRuntimeOptions & {
  llmProviderConcurrency: number
  llmLocalConcurrency: number
  reasoningEffort?: NormalizedReasoningEffort | undefined
}

type GenerationSchedulingOptions = HostedConcurrencyRuntimeOptions & {
  ttsProviderConcurrency: number
  ttsChunkConcurrency: number
  generationResourceGate?: ResourceGate | undefined
  hostedTtsChunkScheduler?: HostedTtsChunkScheduler | undefined
}

export type ModelCostFilterRuntimeOptions = {
  maxModelCents?: number | undefined
  modelCostFilterExcludedTargetKeys?: string[] | undefined
}

export type PricingRuntimeOptions = ModelCostFilterRuntimeOptions & {
  price: boolean
  allowOverBudget: boolean
}

export type UrlRuntimeOptions = {
  urlBackend: HtmlArticleBackend
  urlBackendExplicit: boolean
  urlBackends: HtmlArticleBackend[] | undefined
  urlProviderConcurrency: number
  urlRequestTimeoutMs: number
  urlRequestAttempts: number
}

export type DownloadRuntimeOptions = {
  ytDlpPassthroughArgs: string[] | undefined
}

type PromptRuntimeOptions = {
  prompts: string[]
  promptFile: string | undefined
  renderedText: boolean
  renderedOutDir: string | undefined
  trackList: string | undefined
  promptMd: boolean
}

export type MetadataOutputOptions = {
  markdown: boolean
  save: boolean
}

export type ProcessPlanningOptions = SttSelectionOptions
  & OcrSelectionOptions
  & Pick<BatchRuntimeOptions, 'batchLimit' | 'batchOrder'>
  & Pick<UrlRuntimeOptions, 'urlBackend' | 'urlBackendExplicit' | 'urlBackends'>

export type CommandPricingOptions = ProcessPlanningOptions
  & SttRuntimeOptions
  & OcrRuntimeOptions
  & { hostedOcrTokenProfilePath?: string | undefined }
  & TtsRuntimeOptions
  & ImageRuntimeOptions
  & VideoRuntimeOptions
  & MusicRuntimeOptions
  & LlmRuntimeOptions
  & GenerationSchedulingOptions
  & PricingRuntimeOptions
  & UrlRuntimeOptions
  & Pick<PromptRuntimeOptions, 'prompts' | 'promptFile' | 'promptMd'>

export type ExpectedOutputOptions = ProcessPlanningOptions
  & SttRuntimeOptions
  & OcrRuntimeOptions
  & LlmRuntimeOptions
  & UrlRuntimeOptions
  & PromptRuntimeOptions
  & MetadataOutputOptions
  & Pick<BatchRuntimeOptions, 'bestQuality'>
  & Pick<SharedPipelineOptions, 'youtubeCaptions'>

export type WriteRuntimeOptions = BatchRuntimeOptions
  & Pick<SharedPipelineOptions, 'outputRootDir' | 'configPath' | 'concurrencyMode' | 'hostedConcurrencyCoordinator'>
  & LlmRuntimeOptions
  & PricingRuntimeOptions
  & PromptRuntimeOptions
