import type { OcrConcurrencyMode, OutputFormat, ResolvedLLMModelOptions } from '~/types'

export type OcrRuntimeOptions = {
  ocrConcurrency: number | undefined
  ocrConcurrencyMode: OcrConcurrencyMode
  ocrProviderConcurrency: number
  ocrLocalConcurrency: number
  keepOcrPageInputs: boolean
  dpi: number
  lang: string
  out: OutputFormat
  password: string | undefined
  useTesseract: boolean
  mistralOcrModels: string[] | undefined
  mistralOcrModel: string | undefined
  glmOcrModels: string[] | undefined
  glmOcrModel: string | undefined
  kimiOcrModels: string[] | undefined
  kimiOcrModel: string | undefined
  openaiOcrModels: string[] | undefined
  openaiOcrModel: string | undefined
  grokOcrModels: string[] | undefined
  grokOcrModel: string | undefined
  anthropicOcrModels: string[] | undefined
  anthropicOcrModel: string | undefined
  geminiOcrModels: string[] | undefined
  geminiOcrModel: string | undefined
  deepinfraOcrModels: string[] | undefined
  deepinfraOcrModel: string | undefined
  primaryOcr: string | undefined
  chapterFiles: boolean | undefined
  chapterChunkLimitChars: number | undefined
  pdfChapterMode: 'local' | 'auto' | 'llm'
  useEpubBun: boolean
}

export type OcrExtractionOptions = OcrRuntimeOptions & {
  outputRootDir: string
  configPath: string | undefined
  step2SelectionOrigins: Partial<Record<string, 'default' | 'explicit' | 'all-shortcut'>>
  hostedOcrTokenProfilePath?: string | undefined
} & ResolvedLLMModelOptions

export type OcrRuntimeOptionKey = keyof OcrRuntimeOptions
