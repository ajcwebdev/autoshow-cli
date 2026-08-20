import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { DocumentMetadata, HostedOcrRun, OcrPreparationCache, PageResult } from '~/types'
import { OCR_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'
import {
  classifyOcrCreateRetry,
  OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS,
  OCR_PAGE_REQUEST_ATTEMPTS,
  OCR_PAGE_REQUEST_TIMEOUT_MS,
  OCR_CREATE_RETRY_POLICY,
  OCR_PAGE_REQUEST_RETRY_POLICY,
  OCR_RATE_LIMIT_RETRY_DELAY_MAX_MS,
  OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS,
  OCR_SCHEMA_RETRY_ATTEMPTS,
  withOcrPageRequestRetry
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import {
  createOcrPdfChunkRenderError,
  createRenderedPngPageChunk,
  createOcrPdfChunkWithLocalFallback,
  HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD,
  readFallbackAuditRollup,
  runHostedOcrWithPdfChunkFallback,
  shouldFallbackToOcrPdfChunks,
  stitchHostedOcrChunkRuns
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback'
import { formatSplitPdfDiagnostic } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { buildHostedOcrImageResult } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-utils'
import { createOcrPreparationCache } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/preparation-cache'
import { classifyOcrProviderFailure } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
import {
  OcrStructuredResponseError,
  writeOcrProviderError
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import { runKimiOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/kimi-ocr/run-kimi-ocr'
import { runAnthropicOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/anthropic-ocr/run-anthropic-ocr'
import { l } from '~/utils/app-logger/app-logger'
import { pagesForOcrRange as pagesForRange } from '../../../../test-utils/ocr-page-fixtures'

export { pagesForRange }

export const basePdfMetadata: DocumentMetadata = {
  slug: 'document',
  pageCount: 6,
  format: 'pdf',
  fileSize: 12_345
}

export const hostedRun = (
  pages: PageResult[],
  extras: Partial<HostedOcrRun> = {}
): HostedOcrRun => ({
  pages,
  extractionMethod: 'openai-ocr',
  ocrService: 'openai',
  ocrModel: 'test-model',
  ...extras
})

export const pageCachePath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-results', `page-${String(pageNumber).padStart(6, '0')}.json`)

export const pageTextPath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-results', `page-${String(pageNumber).padStart(6, '0')}.txt`)

export const invalidPageResponsePath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-results', `page-${String(pageNumber).padStart(6, '0')}-invalid-response.txt`)

export const pageInputPath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-inputs', `page-${String(pageNumber).padStart(6, '0')}.pdf`)

export const renderedPageCacheKey = (
  filePath: string,
  page: number,
  dpi: number,
  password?: string | undefined
): string => JSON.stringify({
  filePath,
  page,
  dpi,
  ...(password !== undefined ? { password } : {})
})

export const prefillRenderedPageCache = async (
  cache: OcrPreparationCache,
  dir: string,
  filePath: string,
  pages: number[],
  dpi: number,
  password?: string | undefined
): Promise<void> => {
  await mkdir(dir, { recursive: true })
  for (const page of pages) {
    const imagePath = join(dir, `page-${page}.png`)
    await Bun.write(imagePath, `rendered page ${page}`)
    cache.renderedPages.set(
      renderedPageCacheKey(filePath, page, dpi, password),
      Promise.resolve(imagePath)
    )
  }
}

// Shared with every other suite; re-exported here so existing imports keep working.
export { captureLogEvents } from '../../../../test-utils/console-capture'

// Re-exported rather than redefined: this suite's copy took `(body, status)` while the
// shared helper takes `(body, init)`, so the two spellings could drift on headers.
export { jsonResponse } from '../../../../test-utils/rest-contract-helpers'
export {
  buildHostedOcrImageResult,
  classifyOcrCreateRetry,
  classifyOcrProviderFailure,
  createOcrPdfChunkRenderError,
  createOcrPdfChunkWithLocalFallback,
  createRenderedPngPageChunk,
  createOcrPreparationCache,
  formatSplitPdfDiagnostic,
  HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD,
  join,
  l,
  mkdir,
  OCR_CREATE_RETRY_POLICY,
  OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS,
  OCR_PAGE_REQUEST_ATTEMPTS,
  OCR_PAGE_REQUEST_RETRY_POLICY,
  OCR_PAGE_REQUEST_TIMEOUT_MS,
  OCR_RATE_LIMIT_RETRY_DELAY_MAX_MS,
  OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS,
  OCR_REQUEST_TIMEOUT_MS,
  OCR_SCHEMA_RETRY_ATTEMPTS,
  OcrStructuredResponseError,
  readFallbackAuditRollup,
  rm,
  runHostedOcrWithPdfChunkFallback,
  runAnthropicOcr,
  runKimiOcr,
  shouldFallbackToOcrPdfChunks,
  stitchHostedOcrChunkRuns,
  withOcrPageRequestRetry,
  writeOcrProviderError
}
