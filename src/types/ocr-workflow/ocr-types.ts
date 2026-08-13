import type { ExtractionMetadata, ExtractionResult, HostedOcrSchedulerTelemetry, OcrConcurrencyMode, PageResult, PdfChunkPreparationSummary, ProcessDocumentOutput, ProviderCompletionStatus, ProviderErrorSummaryFields, ProviderRunStateBase, ProviderSuccess, ResolvedStep2Execution, Step1SourceRef } from '~/types'
export type EpubInspectEngine = 'bun'

export type EpubContentEntry = {
  path: string
  size: number
  compressedSize?: number
}

export type EpubContentReader = {
  adapterLabel: string
  entries: EpubContentEntry[]
  hasEntry: (entryPath: string) => boolean
  readText: (entryPath: string) => Promise<string>
}

export type EpubMetadata = {
  title?: string
  creators: string[]
  language?: string
  identifier?: string
  description?: string
  publisher?: string
  publishedAt?: string
  subjects: string[]
}

export type EpubManifestItem = {
  id: string
  href: string
  path: string
  mediaType: string
  properties?: string
}

export type EpubTocItem = {
  id?: string
  playOrder?: number
  title: string
  href?: string
  fragment?: string
  path?: string
  children: EpubTocItem[]
}

export type EpubChapter = {
  index: number
  idref: string
  href: string
  path: string
  title?: string
  tocTitle?: string
  isTocStart?: boolean
  text: string
  wordCount: number
  characterCount: number
}

export type EpubAssets = {
  images: string[]
  stylesheets: string[]
  fonts: string[]
  scripts: string[]
  other: string[]
}

export type EpubInspectionPayload = {
  schemaVersion: 1
  engine: EpubInspectEngine
  container: {
    rootfilePath: string
    mediaType?: string
  }
  packagePath: string
  metadata: EpubMetadata
  manifest: EpubManifestItem[]
  spine: Array<{
    index: number
    idref: string
    linear: string
    manifestId?: string
    href?: string
    mediaType?: string
    path?: string
  }>
  toc: {
    source: 'ncx' | 'nav' | 'none'
    items: EpubTocItem[]
  }
  chapters: EpubChapter[]
  assets: EpubAssets
  inventory: {
    totalFiles: number
    files: EpubContentEntry[]
  }
  stats: {
    chapterCount: number
    totalWords: number
    totalCharacters: number
    totalFiles: number
  }
  diagnostics: {
    adapter: string
    warnings: string[]
  }
}

export type EpubInspectOutput = {
  payload: EpubInspectionPayload
  text: string
}

export type ZipEntry = {
  name: string
  method: number
  compSize: number
  uncompSize: number
  localOffset: number
}

export type ZipXmlPage = {
  page: number
  text: string
}

export type ZipXmlResult = {
  pages: ZipXmlPage[]
  text: string
  totalPages: number
}

export type ZipXmlFormat = 'docx' | 'pptx' | 'xlsx' | 'odf'

export type OcrFn = (imagePath: string) => Promise<{ text: string, confidence?: number }>
export type OcrFnProvider = OcrFn | { getOcrFn: () => Promise<OcrFn> }

export type HostedExtractOcrEngine = 'mistral-ocr' | 'glm-ocr' | 'kimi-ocr' | 'openai-ocr' | 'grok-ocr' | 'anthropic-ocr' | 'gemini-ocr' | 'deepinfra-ocr'

export type HostedOcrRun = {
  pages: PageResult[]
  extractionMethod: HostedExtractOcrEngine
  ocrService: 'mistral' | 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra'
  ocrModel: string
  canonicalText?: string
  totalPages?: number
  promptTokens?: number
  completionTokens?: number
  providerCostCents?: number
  providerCostSource?: 'provider_usage' | 'provider_quote' | 'registry_fallback'
  providerUsage?: Array<Record<string, unknown>>
  pdfChunkPreparation?: PdfChunkPreparationSummary
  hostedOcrScheduler?: HostedOcrSchedulerTelemetry
  requestedReasoningEffort?: import('~/cli/commands/setup-and-utilities/models/reasoning-resolver').NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: import('~/cli/commands/setup-and-utilities/models/reasoning-resolver').NormalizedReasoningEffort | undefined
}

export type OcrTarget = {
  service: 'tesseract' | 'mistral' | 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra'
  model: string
}

export type OcrCloudStagingObject = {
  uri: string
  mimeType: string
  name?: string | undefined
  cleanup?: (() => Promise<void>) | undefined
}

export type OcrPreparationCache = {
  pageTriage: Map<string, Promise<InternalPage>>
  renderedPages: Map<string, Promise<string>>
  cloudStaging: Map<string, Promise<OcrCloudStagingObject>>
  cleanupCallbacks: Array<() => Promise<void>>
  tempDir?: string | undefined
  nextRenderedPageIndex: number
}


export type InternalPage = {
  pageNumber: number
  text: string
  needsOcr: boolean
}

export type TextArtifactFile = {
  relativePath: string
  text: string
}


export type EpubArtifactFile = TextArtifactFile


export type EpubTextSection = {
  index: number
  id: string
  title: string
  href: string
  text: string
  isTocStart?: boolean
  sourceIndexes?: number[]
}


export type OcrRequestedProvider = OcrTarget

export type OcrRecordedProviderError = ProviderErrorSummaryFields & {
  category?: OcrProviderFailureCategory | undefined
  failureKind?: OcrProviderFailureKind | undefined
  retryable?: boolean | undefined
  quota?: boolean | undefined
  providerWide?: boolean | undefined
  blockedReason?: string | undefined
}

export type OcrProviderState = ProviderRunStateBase<OcrTarget['service'], OcrRecordedProviderError>

export type OcrProviderSuccess = ProviderSuccess<OcrTarget, ExtractionMetadata, ExtractionResult>


export type OcrFallbackPageCounts = {
  cached: number
  resumed: number
  succeeded: number
  failed: number
  canceled: number
}

export type OcrProviderFailureSummary = ProviderErrorSummaryFields & {
  category: OcrProviderFailureCategory
  failureKind: OcrProviderFailureKind
  retryable: boolean
  quota?: boolean | undefined
  providerWide?: boolean | undefined
  blockedReason?: string | undefined
  attemptsMade?: number | undefined
  elapsedMs?: number | undefined
}

export type PartialExtractionFailureMetadata = ProviderErrorSummaryFields & {
  category?: OcrProviderFailureCategory | undefined
  failureKind?: OcrProviderFailureKind | undefined
  retryable?: boolean | undefined
  quota?: boolean | undefined
  providerWide?: boolean | undefined
  blockedReason?: string | undefined
  elapsedMs?: number | undefined
}

export type PartialExtractionMetadata = ExtractionMetadata & {
  status: 'failed_partial'
  artifactDir: string
  completedPages: number
  failedPages: number
  failure: PartialExtractionFailureMetadata
}

export type OcrProviderFailureCategory =
  | 'structured_response'
  | 'pdf_chunk_render'
  | 'timeout'
  | 'network'
  | 'auth'
  | 'rate_limit'
  | 'content_policy'
  | 'provider_limit'
  | 'unknown'

export type OcrProviderFailureKind = OcrProviderFailureCategory | 'quota' | 'provider_no_retry'


export type TocScanOptions = {
  allowUnnumbered?: boolean
}

export type TocPageAnalysis = {
  pageNumber: number
  hasTocHeading: boolean
  entries: PdfTocEntry[]
  tocLikeCount: number
  isToc: boolean
}

export type PdfChapterMode = 'local' | 'auto' | 'llm'

export type PdfOutlineEntry = {
  title: string
  pdfPage: number
  depth: number
}

export type PdfPageLabelEntry = {
  pageIndex: number
  style: 'arabic' | 'roman'
  prefix?: string
  startAt: number
}

export type PdfPageLabelCandidate = {
  pdfPage: number
  style: 'arabic' | 'roman'
  raw: string
  value: number
  location: 'top' | 'bottom'
}

export type PdfPageMapSpan = {
  style: 'arabic' | 'roman'
  pdfStartPage: number
  pdfEndPage: number
  printedStartPage: string
  printedEndPage: string
  offset: number
  source: 'page-labels' | 'page-text'
}

export type PdfTocEntry = {
  title: string
  printedPage?: string
  style?: 'arabic' | 'roman'
  numericValue?: number
  tocPdfPage: number
}

export type ResolvedPdfChapter = {
  title: string
  pdfStartPage: number
  printedStartPage?: string
  source: string
  confidence: number
}

export type PdfChapterDetectionSummary = {
  mode: PdfChapterMode
  strategyUsed: string
  overallConfidence: number
  warnings: string[]
  tocPages: number[]
  pageMapSpans: PdfPageMapSpan[]
  chapters: ResolvedPdfChapter[]
  llm?: {
    service: string
    model: string
  }
}


export type OcrMetadataOptions = {
  failures?: Array<{
    service: string
    model: string
    message: string
    category?: string
    stage?: string
    status?: number
    retryAfterMs?: number
    failureKind?: OcrProviderFailureKind
    retryable?: boolean
    quota?: boolean
    providerWide?: boolean
    blockedReason?: string
    attemptsMade?: number
    fallbackPages?: OcrFallbackPageCounts
    fallbackTerminalReason?: string
    errorFile?: string
    rawResponseFile?: string
  }>
  web?: ProcessDocumentOutput['web']
  source?: Step1SourceRef
  completionStatus?: ProviderCompletionStatus
  resolvedStep2?: ResolvedStep2Execution
  requestedProviders?: Array<{ service: string, model: string }>
  providerStates?: Array<Record<string, unknown>>
  missingProviders?: Array<{ service: string, model: string }>
  blockedProviders?: Array<{ service: string, model: string }>
  partialStep2?: PartialExtractionMetadata[] | undefined
  primaryProvider?: { service: string, model: string } | undefined
  ocrConcurrency?: number | undefined
  ocrConcurrencyMode?: OcrConcurrencyMode | undefined
  ocrProviderConcurrency?: number | undefined
  ocrLocalConcurrency?: number | undefined
  hostedOcrScheduler?: HostedOcrSchedulerTelemetry | undefined
}
