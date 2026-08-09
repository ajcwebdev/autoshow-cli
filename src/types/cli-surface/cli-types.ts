import type { BatchRuntimeOptions, HostedTtsChunkScheduler, HtmlArticleBackend, ImageRuntimeOptions, MusicRuntimeOptions, OcrRuntimeOptions, ResourceGate, SttRuntimeOptions, TtsRuntimeOptions, VideoRuntimeOptions } from '~/types'

const PROCESS_COMMANDS = ['metadata', 'download', 'extract', 'write', 'tts', 'image', 'video', 'music'] as const

export type ProcessCommand = typeof PROCESS_COMMANDS[number]

export const OUTPUT_FORMATS = ['text', 'json', 'tsv', 'hocr'] as const
export type OutputFormat = typeof OUTPUT_FORMATS[number]

export type Step2ProviderSelectionOrigin = 'default' | 'explicit' | 'all-shortcut'

export type RuntimeOptions = SttRuntimeOptions & TtsRuntimeOptions & OcrRuntimeOptions & ImageRuntimeOptions & MusicRuntimeOptions & VideoRuntimeOptions & BatchRuntimeOptions & {
  outputRootDir: string
  configPath: string | undefined
  useReverb: boolean
  youtubeCaptions: boolean
  whisperExplicit: boolean
  step2SelectionOrigins: Partial<Record<string, Step2ProviderSelectionOrigin>>
  llamaModels: string[] | undefined
  llamaModel: string | undefined
  llamafileModels: string[] | undefined
  llamafileModel: string | undefined
  openaiModels: string[] | undefined
  openaiModel: string | undefined
  groqModels: string[] | undefined
  groqModel: string | undefined
  geminiModels: string[] | undefined
  geminiModel: string | undefined
  anthropicModels: string[] | undefined
  anthropicModel: string | undefined
  minimaxModels: string[] | undefined
  minimaxModel: string | undefined
  grokModels: string[] | undefined
  grokModel: string | undefined
  glmModels: string[] | undefined
  glmModel: string | undefined
  kimiModels: string[] | undefined
  kimiModel: string | undefined
  togetherModels: string[] | undefined
  togetherModel: string | undefined
  cerebrasModels: string[] | undefined
  cerebrasModel: string | undefined
  llmProviderConcurrency: number
  llmLocalConcurrency: number
  ttsProviderConcurrency: number
  ttsLocalConcurrency: number
  ttsChunkConcurrency: number
  generationResourceGate?: ResourceGate | undefined
  hostedTtsChunkScheduler?: HostedTtsChunkScheduler | undefined
  price: boolean
  allowOverBudget: boolean
  skipLLM: boolean
  urlBackend: HtmlArticleBackend
  urlBackendExplicit: boolean
  urlBackends: HtmlArticleBackend[] | undefined
  urlProviderConcurrency: number
  urlRequestTimeoutMs: number
  urlRequestAttempts: number
  ytDlpPassthroughArgs: string[] | undefined

  prompts: string[]
  promptFile: string | undefined
  textInput: boolean
  renderedText: boolean
  renderedOutDir: string | undefined
  trackList: string | undefined
  promptMd: boolean

  markdown: boolean
  save: boolean
}
