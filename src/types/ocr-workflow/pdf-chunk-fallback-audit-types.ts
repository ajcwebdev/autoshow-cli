import type {
  OcrPdfChunkRange,
  PdfChunkPreparationStrategy,
  PdfChunkPreparationSummary,
  PdfChunkSplitAttempt,
  PdfChunkSplitTool,
  RuntimeToolSource
} from '~/types'

export type InitialFallbackReason = 'forced-page-mode' | 'large-pdf' | 'fallback-state' | 'page-cache' | 'full-document-failure'

export type FallbackPageAuditStatus = 'cached' | 'resumed' | 'succeeded' | 'failed' | 'canceled'

export type FallbackPageAudit = {
  pageNumber: number
  range: OcrPdfChunkRange
  status: FallbackPageAuditStatus
  chunkPreparationMode?: PdfChunkPreparationSummary['strategy'] | undefined
  splitToolFailures?: Array<{
    tool: PdfChunkSplitTool
    exitCodes: Record<string, number>
    path?: string | undefined
    source?: RuntimeToolSource | undefined
    failureKind?: PdfChunkSplitAttempt['failureKind'] | undefined
    message?: string | undefined
  }> | undefined
  failure?: {
    message: string
    category: string
    failureKind?: string | undefined
    retryable?: boolean | undefined
    blockedReason?: string | undefined
    status?: number | undefined
  } | undefined
}

export type FallbackAuditState = {
  initialFallbackReason: InitialFallbackReason
  initialFailure?: {
    message: string
    category: string
    failureKind?: string | undefined
    retryable?: boolean | undefined
    blockedReason?: string | undefined
    status?: number | undefined
  } | undefined
  pageRange: OcrPdfChunkRange
  pages: Map<number, FallbackPageAudit>
}

export type FallbackPageStatusCounts = Record<FallbackPageAuditStatus, number>

export type FallbackAuditRollup = {
  pageStatusCounts?: FallbackPageStatusCounts | undefined
  terminalReason?: string | undefined
  chunkStrategy?: PdfChunkPreparationStrategy | undefined
  rasterizedPages?: number | undefined
}
