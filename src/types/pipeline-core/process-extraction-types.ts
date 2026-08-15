import * as v from 'valibot'
import type { DocFormat, HostedOcrScheduler, ProviderIdentityBase } from '~/types'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { COST_SOURCES } from '../costing/pricing-vocabularies'

export type DetectResult = DocFormat | 'acsm' | null

export type HtmlArticleBackend = 'defuddle' | 'firecrawl' | 'glm-reader' | 'spider' | 'supadata' | 'zyte'

export type UrlArticleTarget = {
  service: HtmlArticleBackend
  model: HtmlArticleBackend
}

export type WebArticleMetadata = {
  sourceUrl?: string
  finalUrl?: string
  title?: string
  author?: string
  site?: string
  published?: string
  language?: string
  wordCount?: number
  description?: string
}

const CostSourceSchema = v.picklist(COST_SOURCES)

export const ExtractionOptionsSchema = v.object({
  filePath: v.string(),
  outputDir: v.string(),
  dpi: v.optional(v.number(), 300),
  languages: v.optional(v.string(), 'eng'),
  outputFormat: v.optional(v.picklist(['text', 'json', 'tsv', 'hocr']), 'text'),
  password: v.optional(v.string(), undefined),
  renderConcurrency: v.optional(v.number(), undefined),
  ocrConcurrency: v.optional(v.number(), undefined),
  ocrConcurrencyMode: v.optional(v.picklist(['auto', 'fixed']), undefined),
  ocrProviderMode: v.optional(v.picklist(['fanout', 'pool']), undefined),
  ocrProviderModeExplicit: v.optional(v.boolean(), undefined),
  ocrPoolDocumentPageNumber: v.optional(v.number(), undefined),
  ocrProviderConcurrency: v.optional(v.number(), DEFAULT_OCR_CONCURRENCY),
  ocrLocalConcurrency: v.optional(v.number(), DEFAULT_OCR_CONCURRENCY),
  useTesseract: v.optional(v.boolean(), undefined),
  mistralOcrModel: v.optional(v.string(), undefined),
  mistralOcrModels: v.optional(v.array(v.string()), undefined),
  glmOcrModel: v.optional(v.string(), undefined),
  glmOcrModels: v.optional(v.array(v.string()), undefined),
  kimiOcrModel: v.optional(v.string(), undefined),
  kimiOcrModels: v.optional(v.array(v.string()), undefined),
  openaiOcrModel: v.optional(v.string(), undefined),
  openaiOcrModels: v.optional(v.array(v.string()), undefined),
  grokOcrModel: v.optional(v.string(), undefined),
  grokOcrModels: v.optional(v.array(v.string()), undefined),
  anthropicOcrModel: v.optional(v.string(), undefined),
  anthropicOcrModels: v.optional(v.array(v.string()), undefined),
  geminiOcrModel: v.optional(v.string(), undefined),
  geminiOcrModels: v.optional(v.array(v.string()), undefined),
  deepinfraOcrModel: v.optional(v.string(), undefined),
  deepinfraOcrModels: v.optional(v.array(v.string()), undefined),
  replicateOcrModel: v.optional(v.string(), undefined),
  replicateOcrModels: v.optional(v.array(v.string()), undefined),
  falOcrModel: v.optional(v.string(), undefined),
  falOcrModels: v.optional(v.array(v.string()), undefined),
  configPath: v.optional(v.string(), undefined),
  primaryOcr: v.optional(v.string(), undefined),
  chapterFiles: v.optional(v.boolean(), undefined),
  chapterChunkLimitChars: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  pdfChapterMode: v.optional(v.picklist(['local', 'auto', 'llm']), 'local'),
  pdfChapterLlmService: v.optional(v.string(), undefined),
  pdfChapterLlmModel: v.optional(v.string(), undefined),
  useEpubBun: v.optional(v.boolean(), undefined),
  step2SelectionOrigins: v.optional(v.record(
    v.string(),
    v.picklist(['default', 'explicit', 'all-shortcut'])
  ), undefined),
  preparedMarkdown: v.optional(v.string(), undefined),
  htmlArticleProcessingTimeMs: v.optional(v.number(), undefined),
  htmlArticleBackend: v.optional(v.picklist(['defuddle', 'firecrawl', 'glm-reader', 'spider', 'supadata', 'zyte']), undefined),
  reasoningEffort: v.optional(v.picklist(['default', 'disabled', 'minimal', 'low', 'medium', 'high', 'max']), undefined)
})

const PageResultSchema = v.object({
  pageNumber: v.number(),
  method: v.picklist(['text', 'ocr', 'skipped']),
  text: v.string(),
  confidence: v.optional(v.number(), undefined)
})

export const ExtractionResultSchema = v.object({
  text: v.string(),
  pages: v.array(PageResultSchema),
  totalPages: v.number(),
  ocrPages: v.number(),
  textPages: v.number()
})

const EpubInspectionSchema = v.record(v.string(), v.unknown())
const ChapterExportSummarySchema = v.object({
  sourceFormat: v.picklist(['epub', 'pdf']),
  normalizedFrom: v.optional(v.string(), undefined),
  mode: v.picklist(['chapters', 'chunks']),
  chunkLimitChars: v.optional(v.number(), undefined),
  sectionsKept: v.number(),
  sectionsDropped: v.number(),
  dividerSectionsMerged: v.number(),
  logicalChapterCount: v.optional(v.number(), undefined),
  logicalChapterSource: v.optional(v.picklist(['toc', 'spine', 'heading']), undefined),
  tocStartSections: v.optional(v.number(), undefined),
  pageLikeTocStartsIgnored: v.optional(v.number(), undefined),
  genericTocStartsIgnored: v.optional(v.number(), undefined),
  bodyTextTocStartsIgnored: v.optional(v.number(), undefined),
  prefaceSectionsDropped: v.optional(v.number(), undefined),
  filesWritten: v.number(),
  chapterFilesWritten: v.optional(v.number(), undefined),
  chunkFilesWritten: v.optional(v.number(), undefined),
  directories: v.array(v.string())
})

export const ExtractionMetadataSchema = v.object({
  extractionMethod: v.picklist([
    'docx', 'pptx', 'xlsx', 'odf', 'tesseract', 'mutool+tesseract', 'mistral-ocr', 'openai-ocr', 'grok-ocr', 'ocr-pool', 'epub-bun',
    'epub-text',
    'pdf-text', 'pdf+tesseract', 'pdf+mistral-ocr', 'pdf+glm-ocr', 'pdf+kimi-ocr', 'pdf+openai-ocr', 'pdf+grok-ocr', 'pdf+anthropic-ocr', 'pdf+gemini-ocr', 'pdf+deepinfra-ocr', 'pdf+replicate-ocr', 'pdf+fal-ocr',
    'office-native', 'rtf-native',
    'cbz+tesseract', 'cbz+mistral-ocr', 'cbz+glm-ocr', 'cbz+kimi-ocr', 'cbz+openai-ocr', 'cbz+grok-ocr', 'cbz+anthropic-ocr', 'cbz+gemini-ocr', 'cbz+deepinfra-ocr', 'cbz+replicate-ocr', 'cbz+fal-ocr',
    'csv-raw',
    'image+tesseract', 'image+mistral-ocr', 'image+glm-ocr', 'image+kimi-ocr', 'image+openai-ocr', 'image+grok-ocr', 'image+anthropic-ocr', 'image+gemini-ocr', 'image+deepinfra-ocr', 'image+replicate-ocr', 'image+fal-ocr',
    'glm-ocr',
    'kimi-ocr',
    'openai-ocr',
    'grok-ocr',
    'anthropic-ocr',
    'gemini-ocr',
    'deepinfra-ocr',
    'replicate-ocr',
    'fal-ocr',
    'html+defuddle', 'html+firecrawl', 'html+glm-reader', 'html+spider', 'html+supadata', 'html+zyte'
  ]),
  totalPages: v.number(),
  ocrPages: v.number(),
  textPages: v.number(),
  processingTime: v.number(),
  dpi: v.number(),
  languages: v.string(),
  tokenEstimate: v.number(),
  ocrModel: v.optional(v.string(), undefined),
  ocrService: v.optional(v.string(), undefined),
  promptTokens: v.optional(v.number(), undefined),
  completionTokens: v.optional(v.number(), undefined),
  epub: v.optional(EpubInspectionSchema, undefined),
  chapterExport: v.optional(ChapterExportSummarySchema, undefined),
  pdfChapterDetection: v.optional(v.record(v.string(), v.unknown()), undefined),
  inputFamily: v.optional(v.string(), undefined),
  normalizedFrom: v.optional(v.string(), undefined),
  conversionChain: v.optional(v.array(v.string()), undefined),
  outputFormat: v.optional(v.string(), undefined),
  outputFidelity: v.optional(v.string(), undefined),
  metadataSchemaVersion: v.optional(v.number(), undefined),
  providerCostCents: v.optional(v.number(), undefined),
  providerCostSource: v.optional(CostSourceSchema, undefined),
  pdfChunkPreparation: v.optional(v.record(v.string(), v.unknown()), undefined),
  ocrProviderUsage: v.optional(v.array(v.record(v.string(), v.unknown())), undefined),
  hostedOcrScheduler: v.optional(v.record(v.string(), v.unknown()), undefined),
  hostedConcurrency: v.optional(v.record(v.string(), v.unknown()), undefined),
  requestedReasoningEffort: v.optional(v.picklist(['default', 'disabled', 'minimal', 'low', 'medium', 'high', 'max']), undefined),
  effectiveReasoningEffort: v.optional(v.picklist(['default', 'disabled', 'minimal', 'low', 'medium', 'high', 'max']), undefined),
  ocrProviderMode: v.optional(v.picklist(['fanout', 'pool']), undefined),
  ocrPoolTargetUsage: v.optional(v.array(v.record(v.string(), v.unknown())), undefined)
})

export const DocumentMetadataSchema = v.object({
  title: v.optional(v.string(), undefined),
  slug: v.string(),
  author: v.optional(v.string(), undefined),
  pageCount: v.number(),
  format: v.picklist([
    'pdf', 'epub', 'png', 'jpg', 'tif', 'docx', 'pptx', 'xlsx', 'odf',
    'mobi', 'azw3', 'fb2', 'lit', 'cbz', 'rtf', 'csv', 'webp', 'bmp', 'gif',
    'html'
  ]),
  fileSize: v.number(),
  sourceFormat: v.optional(v.string(), undefined),
  normalizedFormat: v.optional(v.string(), undefined),
  conversionChain: v.optional(v.array(v.string()), undefined),
  metadataSchemaVersion: v.optional(v.number(), undefined)
})

export type PreparedDocument = {
  outputDir: string
  step1Metadata: DocumentMetadata
  effectiveFilePath?: string
  tempCleanup?: () => Promise<void>
  preparedMarkdown?: string
  htmlArticleProcessingTimeMs?: number
  htmlArticleBackend?: HtmlArticleBackend
  web?: WebArticleMetadata
}

export type ProcessDocumentOutput = {
  result: ExtractionResult
  step1Metadata: DocumentMetadata
  step2Metadata: ExtractionMetadata | ExtractionMetadata[]
  partialStep2?: Array<ExtractionMetadata & {
    status: 'failed_partial'
    artifactDir: string
    completedPages: number
    failedPages: number
    failure: unknown
  }> | undefined
  completionStatus?: 'full' | 'incomplete' | 'failed' | undefined
  requestedProviders?: ProviderIdentityBase[] | undefined
  providerStates?: Array<Record<string, unknown>> | undefined
  missingProviders?: ProviderIdentityBase[] | undefined
  blockedProviders?: ProviderIdentityBase[] | undefined
  ocrProviderMode?: import('~/types').OcrProviderMode | undefined
  ocrPool?: import('~/types').OcrPoolLedger | undefined
  web?: WebArticleMetadata | undefined
  step2Errors?: Array<ProviderIdentityBase & {
    message: string
    category?: string
    failureKind?: string
    retryable?: boolean
    quota?: boolean
    providerWide?: boolean
    blockedReason?: string
    attemptsMade?: number
    fallbackPages?: { cached: number, resumed: number, succeeded: number, failed: number, canceled: number }
    fallbackTerminalReason?: string
    errorFile?: string
  }> | undefined
  outputDir: string
}

export type ExtractionOptions = v.InferOutput<typeof ExtractionOptionsSchema> & {
  ocrPreparationCache?: import('~/types').OcrPreparationCache | undefined
  hostedOcrScheduler?: HostedOcrScheduler | undefined
  concurrencyMode?: import('~/types').HostedConcurrencyMode | undefined
  hostedConcurrencyCoordinator?: import('~/types').HostedConcurrencyCoordinator | undefined
}
export type PageResult = v.InferOutput<typeof PageResultSchema>
export type ExtractionResult = v.InferOutput<typeof ExtractionResultSchema>
export type ExtractionMetadata = v.InferOutput<typeof ExtractionMetadataSchema>
export type DocumentMetadata = v.InferOutput<typeof DocumentMetadataSchema>
