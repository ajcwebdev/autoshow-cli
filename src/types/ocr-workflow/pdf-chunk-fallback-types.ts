import type { CommandResultBase, DocumentMetadata, HostedOcrIdentity, HostedOcrRun, RuntimeToolSource } from '~/types'
export type OcrPdfChunkRange = {
  startPage: number
  endPage: number
}

export type PdfChunkCommandResult = CommandResultBase

export type PdfChunkSplitTool = 'qpdf' | 'mutool'

export type PdfChunkSplitAttempt = {
  tool: PdfChunkSplitTool
  exitCode: number
  path?: string | undefined
  source?: RuntimeToolSource | undefined
  failureKind?: 'qpdf_launch_failure' | 'qpdf_unavailable' | 'mutool_unsupported_document' | 'split_failed' | undefined
  message?: string | undefined
}

export type PdfChunkSplitLogMode = 'warn' | 'debug' | 'silent'

export type PdfChunkSplitOptions = {
  logMode?: PdfChunkSplitLogMode | undefined
  logLabel?: string | undefined
  disabledTools?: PdfChunkSplitTool[] | undefined
}

export type PdfChunkSplitResult = PdfChunkCommandResult & {
  tool: PdfChunkSplitTool
  attempts?: PdfChunkSplitAttempt[] | undefined
}

export type PdfChunkLocalTools = {
  splitPdfPages: (
    inputPath: string,
    outputPath: string,
    pageRange: string,
    password?: string | undefined,
    options?: PdfChunkSplitOptions | undefined
  ) => Promise<PdfChunkSplitResult>
  renderPageToImage: (
    filePath: string,
    page: number,
    dpi: number,
    outPath: string,
    password?: string | undefined
  ) => Promise<PdfChunkCommandResult>
  convertDocumentToPdf: (
    filePath: string,
    outPath: string
  ) => Promise<PdfChunkCommandResult>
}

export type PdfChunkPreparationStrategy = 'adaptive' | 'direct' | 'raster-only'

export type PdfChunkPreparationToolSummary = {
  tool: PdfChunkSplitTool
  attempts: number
  exitCodes: Record<string, number>
  path?: string | undefined
  source?: RuntimeToolSource | undefined
  failureKind?: PdfChunkSplitAttempt['failureKind'] | undefined
  message?: string | undefined
}

export type PdfChunkDisabledToolSummary = {
  tool: PdfChunkSplitTool
  disabledAtPage: number
  reason: string
  exitCode?: number | undefined
  fallbackTool?: PdfChunkSplitTool | undefined
}

export type PdfChunkPreparationSummary = {
  strategy: PdfChunkPreparationStrategy
  directPageAttempts: number
  directSuccesses: number
  directFailures: number
  rasterizedPages: number
  directSplittingDisabled: boolean
  disabledAtPage?: number | undefined
  tools: PdfChunkPreparationToolSummary[]
  disabledTools?: PdfChunkDisabledToolSummary[] | undefined
  lastDirectFailure?: {
    pageNumber: number
    tool: PdfChunkSplitTool
    exitCode: number
    path?: string | undefined
    source?: RuntimeToolSource | undefined
    failureKind?: PdfChunkSplitAttempt['failureKind'] | undefined
    message: string
  } | undefined
}

export type RunHostedOcrPdfChunkFallbackOptions = {
  filePath: string
  step1Metadata: DocumentMetadata
  serviceLabel: string
  totalPages: number
  dpi?: number | undefined
  password?: string | undefined
  fallbackDir?: string | undefined
  pageConcurrency?: number | undefined
  keepPageInputs?: boolean | undefined
  forcePageMode?: boolean | undefined
  cacheIdentity?: HostedOcrIdentity | undefined
  runFull: () => Promise<HostedOcrRun>
  runChunk: (chunkPath: string, chunkMetadata: DocumentMetadata, range: OcrPdfChunkRange) => Promise<HostedOcrRun>
  buildMalformedPageRun?: (rawText: string, range: OcrPdfChunkRange) => HostedOcrRun
  createChunk?: (inputPath: string, outputPath: string, range: OcrPdfChunkRange, password?: string | undefined) => Promise<void>
  chunkFormat?: DocumentMetadata['format'] | undefined
  chunkExtension?: string | undefined
  chunkTools?: PdfChunkLocalTools | undefined
}
