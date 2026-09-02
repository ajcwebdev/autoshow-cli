import type { HostedOcrRun, InitialFallbackReason, RunHostedOcrPdfChunkFallbackOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { classifyOcrProviderFailure } from '../ocr-run-state'
import { shouldFallbackToOcrPdfChunks } from './pdf-chunk-fallback-classifier'
import { resolveInitialFallbackReason } from './pdf-chunk-fallback-state'
import { runPdfPageFallback } from './pdf-page-fallback-workers'

export { createOcrPdfChunkRenderError, HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD } from './pdf-chunk-fallback-shared'
export { shouldFallbackToOcrPdfChunks } from './pdf-chunk-fallback-classifier'
export { stitchHostedOcrChunkRuns } from './pdf-chunk-page-remap'
export { readFallbackAuditRollup } from './pdf-chunk-fallback-audit'
export { createRenderedPngPageChunk, createOcrPdfChunkWithLocalFallback } from './pdf-rasterized-chunking'

const logInitialFallbackStrategy = (
  options: RunHostedOcrPdfChunkFallbackOptions,
  totalPages: number,
  reason: InitialFallbackReason
): void => {
  if (reason === 'forced-page-mode') {
    l.write('info', `${options.serviceLabel}: using resumable rendered-page OCR`, { category: 'pipeline', metadata: { service: options.serviceLabel, mode: 'rendered-page' } })
  } else if (reason === 'large-pdf') {
    l.write('info', `${options.serviceLabel}: PDF has ${totalPages} pages; using resumable single-page OCR`, { category: 'pipeline', metadata: { service: options.serviceLabel, totalPages, mode: 'single-page' } })
  } else {
    l.write('info', `${options.serviceLabel}: OCR page fallback artifacts found; resuming single-page OCR`, { category: 'pipeline', metadata: { service: options.serviceLabel, mode: 'single-page', resumed: true } })
  }
}

export const runHostedOcrWithPdfChunkFallback = async (
  options: RunHostedOcrPdfChunkFallbackOptions
): Promise<HostedOcrRun> => {
  const totalPages = Math.max(1, Math.floor(options.totalPages))
  const initialFallbackReason = await resolveInitialFallbackReason(options, totalPages)
  if (initialFallbackReason !== undefined) {
    logInitialFallbackStrategy(options, totalPages, initialFallbackReason)
    return await runPdfPageFallback(options, totalPages, initialFallbackReason)
  }
  try {
    return await options.runFull()
  } catch (error) {
    if (!shouldFallbackToOcrPdfChunks(error)) throw error
    const failure = classifyOcrProviderFailure(error)
    const message = failure.message
    l.warn(`${options.serviceLabel}: full-document OCR failed (${message}); retrying PDF one page at a time`, {
      category: 'pipeline',
      metadata: { service: options.serviceLabel, mode: 'single-page', failureCategory: failure.category, failureKind: failure.failureKind, retryable: failure.retryable }, error: error,
    })
    return await runPdfPageFallback(options, totalPages, 'full-document-failure', {
      message,
      category: failure.category,
      failureKind: failure.failureKind,
      retryable: failure.retryable,
      ...(failure.blockedReason ? { blockedReason: failure.blockedReason } : {}),
      ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
    })
  }
}
