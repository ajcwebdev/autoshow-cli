import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DocumentMetadata, HostedOcrRun, LogSinkEvent, OcrPreparationCache, PageResult } from '~/types'
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

export const basePdfMetadata: DocumentMetadata = {
  slug: 'document',
  pageCount: 6,
  format: 'pdf',
  fileSize: 12_345
}

export const pagesForRange = (startPage: number, endPage: number): PageResult[] => {
  const pages: PageResult[] = []
  for (let pageNumber = 1; pageNumber <= endPage - startPage + 1; pageNumber++) {
    pages.push({
      pageNumber,
      method: 'ocr',
      text: `page ${startPage + pageNumber - 1}`
    })
  }
  return pages
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

export const captureLogEvents = async <T>(
  run: () => Promise<T>
): Promise<{ result: T, events: LogSinkEvent[] }> => {
  const originalSinks = [...l.config.sinks]
  const events: LogSinkEvent[] = []
  l.config.sinks.length = 0
  l.config.sinks.push((event) => {
    events.push(event)
  })

  try {
    return {
      result: await run(),
      events
    }
  } finally {
    l.config.sinks.length = 0
    l.config.sinks.push(...originalSinks)
  }
}

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  })
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
  mkdtemp,
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
  tmpdir,
  withOcrPageRequestRetry,
  writeOcrProviderError
}

export type {
  DocumentMetadata,
  HostedOcrRun,
  LogSinkEvent,
  OcrPreparationCache,
  PageResult
}
