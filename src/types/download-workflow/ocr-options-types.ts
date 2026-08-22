import type { NormalizedReasoningEffort, OcrConcurrencyMode, OcrProviderMode, OutputFormat, ResolvedLLMModelOptions } from '~/types'

export type OcrRuntimeOptions = {
  ocrConcurrency: number | undefined
  ocrConcurrencyMode: OcrConcurrencyMode
  ocrProviderMode: OcrProviderMode
  ocrProviderModeExplicit: boolean
  ocrProviderConcurrency: number
  ocrLocalConcurrency: number
  dpi: number
  lang: string
  out: OutputFormat
  password: string | undefined
  useTesseract: boolean
  mistralOcrModels: string[] | undefined
  glmOcrModels: string[] | undefined
  kimiOcrModels: string[] | undefined
  openaiOcrModels: string[] | undefined
  grokOcrModels: string[] | undefined
  anthropicOcrModels: string[] | undefined
  geminiOcrModels: string[] | undefined
  deepinfraOcrModels: string[] | undefined
  replicateOcrModels: string[] | undefined
  falOcrModels: string[] | undefined
  primaryOcr: string | undefined
  chapterFiles: boolean | undefined
  chapterChunkLimitChars: number | undefined
  pdfChapterMode: 'local' | 'auto' | 'llm'
  reasoningEffort?: NormalizedReasoningEffort | undefined
}

export type OcrExtractionOptions = OcrRuntimeOptions & {
  outputRootDir: string
  configPath: string | undefined
  step2SelectionOrigins: Partial<Record<string, 'default' | 'explicit' | 'all-shortcut'>>
  hostedOcrTokenProfilePath?: string | undefined
} & ResolvedLLMModelOptions

export type OcrRuntimeOptionKey = keyof OcrRuntimeOptions
