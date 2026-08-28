import { rm } from 'node:fs/promises'
import type { FallbackAuditState, HostedOcrRun, InitialFallbackReason, RunHostedOcrPdfChunkFallbackOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InternalError } from '~/utils/error-handler'
import { normalizeOcrPageConcurrency } from './ocr-page-concurrency'
import { formatRange, hasNonEmptyFile } from './pdf-chunk-fallback-shared'
import { stitchHostedOcrChunkRuns } from './pdf-chunk-page-remap'
import { isProviderWideNonRetryableOcrFailure, setFallbackPageAudit, summarizeFallbackFailure } from './pdf-chunk-fallback-audit'
import {
  buildMalformedFallbackPageRun, cleanupFallbackPageInputs, readCachedFallbackPage, resolveFallbackChunkPath,
  validateSinglePageFallbackRun, writeCachedFallbackPage, writeFallbackPartialText,
  writeInvalidFallbackPageResponse
} from './pdf-chunk-fallback-state'
import {
  type PdfPageFallbackSession, buildChunkMetadata, createPdfPageFallbackSession,
  fallbackChunkPreparationSummary, logFallbackProgress, queueFallbackStateWrite, remapChunkRun
} from './pdf-page-fallback-session'

export const processFallbackPage = async (
  session: PdfPageFallbackSession,
  pageNumber: number
): Promise<HostedOcrRun> => {
  const { options, totalPages } = session
  const cached = await readCachedFallbackPage(options.fallbackDir, pageNumber, totalPages, session.cacheValidation)
  if (cached !== undefined) {
    setFallbackPageAudit(session.audit, pageNumber, 'cached', { chunkPreparation: fallbackChunkPreparationSummary(session) })
    await writeCachedFallbackPage(options.fallbackDir, pageNumber, totalPages, session.sourceFile, cached)
    l.write('debug', `${options.serviceLabel}: OCR fallback page ${pageNumber} already cached`, {
      category: 'pipeline',
      metadata: { service: options.serviceLabel, pageNumber, cached: true },
    })
    return cached
  }

  const range = { startPage: pageNumber, endPage: pageNumber }
  if (session.initialFallbackReason === 'fallback-state') {
    setFallbackPageAudit(session.audit, pageNumber, 'resumed', { chunkPreparation: fallbackChunkPreparationSummary(session) })
  }
  const chunkFormat = options.chunkFormat ?? 'pdf'
  const chunkExtension = options.chunkExtension ?? (chunkFormat === 'jpg' ? 'jpg' : chunkFormat)
  const { chunkPath, persistent } = await resolveFallbackChunkPath(options.fallbackDir, session.tempDir, options.filePath, pageNumber, chunkExtension)
  try {
    l.write('debug', `${options.serviceLabel}: OCR fallback ${formatRange(range)}`, {
      category: 'pipeline',
      metadata: { service: options.serviceLabel, startPage: range.startPage, endPage: range.endPage },
    })
    if (!await hasNonEmptyFile(chunkPath)) await session.createChunk(options.filePath, chunkPath, range, options.password)
    const chunkMetadata = await buildChunkMetadata(chunkPath, options.step1Metadata, range, chunkFormat)
    const pageRun = validateSinglePageFallbackRun(
      remapChunkRun(await options.runChunk(chunkPath, chunkMetadata, range), range),
      pageNumber,
      options.serviceLabel
    )
    await writeCachedFallbackPage(options.fallbackDir, pageNumber, totalPages, session.sourceFile, pageRun)
    setFallbackPageAudit(session.audit, pageNumber, 'succeeded', { chunkPreparation: fallbackChunkPreparationSummary(session) })
    return pageRun
  } catch (error) {
    await writeInvalidFallbackPageResponse(options.fallbackDir, pageNumber, error)
    const malformedPageRun = buildMalformedFallbackPageRun(options, error, range)
    if (malformedPageRun !== undefined) {
      l.warn(`${options.serviceLabel}: OCR fallback page ${pageNumber} returned malformed structured output; treating raw response as page text`, {
        category: 'pipeline',
        metadata: { service: options.serviceLabel, pageNumber },
      })
      await writeCachedFallbackPage(options.fallbackDir, pageNumber, totalPages, session.sourceFile, malformedPageRun)
      setFallbackPageAudit(session.audit, pageNumber, 'succeeded', { chunkPreparation: fallbackChunkPreparationSummary(session) })
      return malformedPageRun
    }
    setFallbackPageAudit(session.audit, pageNumber, 'failed', {
      chunkPreparation: fallbackChunkPreparationSummary(session),
      failure: summarizeFallbackFailure(error),
    })
    await queueFallbackStateWrite(session)
    throw error
  } finally {
    if (!persistent) await rm(chunkPath, { force: true }).catch(() => {})
  }
}

export const runFallbackWorkers = async (
  session: PdfPageFallbackSession,
  pageNumbers: number[],
  onResult: (
    run: HostedOcrRun,
    pageNumber: number,
    index: number,
    results: ReadonlyArray<HostedOcrRun | undefined>
  ) => Promise<void>
): Promise<HostedOcrRun[]> => {
  const results: Array<HostedOcrRun | undefined> = new Array(pageNumbers.length)
  const concurrency = normalizeOcrPageConcurrency(session.options.pageConcurrency)
  let next = 0
  let stopScheduling = false
  let firstError: unknown
  let providerWideBlocker: unknown
  const runWorker = async (): Promise<void> => {
    while (!stopScheduling) {
      const index = next
      next += 1
      if (index >= pageNumbers.length) return
      const pageNumber = pageNumbers[index] as number
      try {
        const result = await processFallbackPage(session, pageNumber)
        results[index] = result
        await onResult(result, pageNumber, index, results)
      } catch (error) {
        firstError ??= error
        if (isProviderWideNonRetryableOcrFailure(error)) providerWideBlocker ??= error
        stopScheduling = true
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pageNumbers.length) }, runWorker))
  if (providerWideBlocker !== undefined) {
    const failure = summarizeFallbackFailure(providerWideBlocker)
    for (let index = 0; index < pageNumbers.length; index++) {
      const pageNumber = pageNumbers[index] as number
      if (results[index] !== undefined || session.audit.pages.has(pageNumber)) continue
      setFallbackPageAudit(session.audit, pageNumber, 'canceled', {
        chunkPreparation: fallbackChunkPreparationSummary(session),
        failure,
      })
    }
    await queueFallbackStateWrite(session)
    await session.stateWrite
  }
  if (firstError !== undefined) throw firstError
  return results.map((result, index) => {
    if (result === undefined) throw InternalError(`OCR fallback page ${pageNumbers[index]} did not produce a result.`, { stage: 'ocr:pdf-chunk-fallback' })
    return result
  })
}

export const runPdfPageFallback = async (
  options: RunHostedOcrPdfChunkFallbackOptions,
  totalPages: number,
  initialFallbackReason: InitialFallbackReason,
  initialFailure?: FallbackAuditState['initialFailure'] | undefined
): Promise<HostedOcrRun> => {
  const session = await createPdfPageFallbackSession(options, totalPages, initialFallbackReason, initialFailure)
  try {
    await queueFallbackStateWrite(session)
    let partialWrite = Promise.resolve()
    const pageNumbers = Array.from({ length: totalPages }, (_value, index) => index + 1)
    const runs = await runFallbackWorkers(session, pageNumbers, async (_run, _pageNumber, _index, results) => {
      const completedRuns = results.filter((run): run is HostedOcrRun => run !== undefined)
      partialWrite = partialWrite.then(async () => await writeFallbackPartialText(options.fallbackDir, completedRuns))
      await partialWrite
      await queueFallbackStateWrite(session)
      logFallbackProgress(session, completedRuns.length)
    })
    await partialWrite
    await writeFallbackPartialText(options.fallbackDir, runs)
    await queueFallbackStateWrite(session)
    await session.stateWrite
    const stitched = stitchHostedOcrChunkRuns(runs, totalPages, fallbackChunkPreparationSummary(session))
    if (options.keepPageInputs !== true) await cleanupFallbackPageInputs(options.fallbackDir, options.serviceLabel)
    return stitched
  } finally {
    await rm(session.tempDir, { recursive: true, force: true })
  }
}
