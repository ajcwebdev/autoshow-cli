import type { BatchRuntimeOptions, HostedTtsChunkScheduler, HtmlArticleBackend, ImageRuntimeOptions, MusicRuntimeOptions, OcrRuntimeOptions, OcrSelectionOptions, ResolvedLLMModelOptions, ResourceGate, SttRuntimeOptions, SttSelectionOptions, TtsRuntimeOptions, VideoRuntimeOptions } from '~/types'

export const PROCESS_COMMANDS = ['metadata', 'download', 'extract', 'write', 'tts', 'image', 'video', 'music', 'comic'] as const

export type ProcessCommand = typeof PROCESS_COMMANDS[number]

export const OUTPUT_FORMATS = ['text', 'json', 'tsv', 'hocr'] as const
export type OutputFormat = typeof OUTPUT_FORMATS[number]

export type Step2ProviderSelectionOrigin = 'default' | 'explicit' | 'all-shortcut'

export type SharedPipelineOptions = {
  outputRootDir: string
  configPath: string | undefined
  useReverb: boolean
  youtubeCaptions: boolean
  whisperExplicit: boolean
  step2SelectionOrigins: Partial<Record<string, Step2ProviderSelectionOrigin>>
}

export type LlmRuntimeOptions = ResolvedLLMModelOptions & {
  llmProviderConcurrency: number
  llmLocalConcurrency: number
  reasoningEffort?: import('~/cli/commands/setup-and-utilities/models/reasoning-resolver').NormalizedReasoningEffort | undefined
}

export type GenerationSchedulingOptions = {
  ttsProviderConcurrency: number
  ttsLocalConcurrency: number
  ttsChunkConcurrency: number
  generationResourceGate?: ResourceGate | undefined
  hostedTtsChunkScheduler?: HostedTtsChunkScheduler | undefined
}

export type PricingRuntimeOptions = {
  price: boolean
  allowOverBudget: boolean
}

export type UrlRuntimeOptions = {
  skipLLM: boolean
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

export type PromptRuntimeOptions = {
  prompts: string[]
  promptFile: string | undefined
  textInput: boolean
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
  & Pick<OcrRuntimeOptions, 'useEpubBun'>
  & Pick<BatchRuntimeOptions, 'batchLimit' | 'batchAll' | 'batchOrder'>
  & Pick<UrlRuntimeOptions, 'urlBackend' | 'urlBackendExplicit' | 'urlBackends'>
  & Pick<PromptRuntimeOptions, 'textInput'>

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
  & Pick<PromptRuntimeOptions, 'prompts' | 'promptFile' | 'textInput' | 'promptMd'>

export type ExpectedOutputOptions = ProcessPlanningOptions
  & SttRuntimeOptions
  & OcrRuntimeOptions
  & TtsRuntimeOptions
  & ImageRuntimeOptions
  & VideoRuntimeOptions
  & MusicRuntimeOptions
  & LlmRuntimeOptions
  & UrlRuntimeOptions
  & PromptRuntimeOptions
  & MetadataOutputOptions
  & Pick<BatchRuntimeOptions, 'bestQuality'>
  & Pick<SharedPipelineOptions, 'youtubeCaptions'>

export type WriteRuntimeOptions = SttRuntimeOptions
  & TtsRuntimeOptions
  & OcrRuntimeOptions
  & ImageRuntimeOptions
  & MusicRuntimeOptions
  & VideoRuntimeOptions
  & BatchRuntimeOptions
  & SharedPipelineOptions
  & LlmRuntimeOptions
  & GenerationSchedulingOptions
  & PricingRuntimeOptions
  & UrlRuntimeOptions
  & DownloadRuntimeOptions
  & PromptRuntimeOptions
  & MetadataOutputOptions
