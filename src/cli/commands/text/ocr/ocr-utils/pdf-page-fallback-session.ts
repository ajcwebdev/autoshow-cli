import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { statPath as stat } from '~/utils/bun-file-io'
import type { DocumentMetadata, FallbackAuditState, HostedOcrRun, InitialFallbackReason, OcrPdfChunkRange, PdfChunkPreparationSummary, RunHostedOcrPdfChunkFallbackOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { createAdaptiveOcrPdfPageChunkCreator, createOcrPdfChunkWithLocalFallback } from './pdf-rasterized-chunking'
import { getOcrPdfChunkRangePageCount } from './pdf-chunk-fallback-shared'
import { remapOcrPagesToRange, remapOcrProviderUsageToRange } from './pdf-chunk-page-remap'
import { formatDirectSplittingDisabledWarning, hasObservedChunkPreparation, readFallbackChunkPreparation } from './pdf-chunk-fallback-audit'
import { writeFallbackState } from './pdf-chunk-fallback-state'

export const defaultCreatePdfChunk = async (
  inputPath: string,
  outputPath: string,
  range: OcrPdfChunkRange,
  password?: string | undefined,
  dpi?: number | undefined,
  logLabel?: string | undefined
): Promise<void> =>
  await createOcrPdfChunkWithLocalFallback({
    inputPath,
    outputPath,
    range,
    password,
    dpi,
    logLabel
  })

export const buildChunkMetadata = async (
  chunkPath: string,
  baseMetadata: DocumentMetadata,
  range: OcrPdfChunkRange,
  format: DocumentMetadata['format'] = 'pdf'
): Promise<DocumentMetadata> => {
  const chunkStats = await stat(chunkPath)
  return {
    ...baseMetadata,
    format,
    fileSize: chunkStats.size,
    pageCount: getOcrPdfChunkRangePageCount(range)
  }
}

export const remapChunkRun = (
  run: HostedOcrRun,
  range: OcrPdfChunkRange
): HostedOcrRun => {
  const providerUsage = remapOcrProviderUsageToRange(run.providerUsage, range)
  return {
    ...run,
    pages: remapOcrPagesToRange(run.pages, range),
    totalPages: getOcrPdfChunkRangePageCount(range),
    ...(providerUsage !== undefined ? { providerUsage } : {})
  }
}

export type PdfPageFallbackSession = {
  options: RunHostedOcrPdfChunkFallbackOptions
  totalPages: number
  initialFallbackReason: InitialFallbackReason
  tempDir: string
  sourceFile: string
  cacheValidation: { sourceFile: string, identity: RunHostedOcrPdfChunkFallbackOptions['cacheIdentity'] }
  audit: FallbackAuditState
  storedChunkPreparation?: PdfChunkPreparationSummary | undefined
  adaptiveChunkCreator?: ReturnType<typeof createAdaptiveOcrPdfPageChunkCreator> | undefined
  createChunk: NonNullable<RunHostedOcrPdfChunkFallbackOptions['createChunk']>
  stateWrite: Promise<void>
}

export const fallbackChunkPreparationSummary = (session: PdfPageFallbackSession): PdfChunkPreparationSummary | undefined => {
  const current = session.adaptiveChunkCreator?.getSummary()
  return hasObservedChunkPreparation(current) ? current : session.storedChunkPreparation
}

export const queueFallbackStateWrite = (session: PdfPageFallbackSession): Promise<void> => {
  session.stateWrite = session.stateWrite.then(async () => {
    await writeFallbackState(
      session.options.fallbackDir,
      session.options,
      session.totalPages,
      fallbackChunkPreparationSummary(session),
      session.audit
    )
  })
  return session.stateWrite
}

export const createPdfPageFallbackSession = async (
  options: RunHostedOcrPdfChunkFallbackOptions,
  totalPages: number,
  initialFallbackReason: InitialFallbackReason,
  initialFailure?: FallbackAuditState['initialFailure'] | undefined
): Promise<PdfPageFallbackSession> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-pdf-pages-'))
  const sourceFile = basename(options.filePath)
  const session: PdfPageFallbackSession = {
    options,
    totalPages,
    initialFallbackReason,
    tempDir,
    sourceFile,
    cacheValidation: { sourceFile, identity: options.cacheIdentity },
    audit: {
      initialFallbackReason,
      ...(initialFailure ? { initialFailure } : {}),
      pageRange: { startPage: 1, endPage: totalPages },
      pages: new Map(),
    },
    ...(options.createChunk === undefined ? { storedChunkPreparation: await readFallbackChunkPreparation(options.fallbackDir) } : {}),
    createChunk: options.createChunk ?? ((inputPath, outputPath, range, password) =>
      defaultCreatePdfChunk(inputPath, outputPath, range, password, options.dpi, options.serviceLabel)),
    stateWrite: Promise.resolve(),
  }
  if (options.createChunk === undefined) {
    session.adaptiveChunkCreator = createAdaptiveOcrPdfPageChunkCreator({
      dpi: options.dpi,
      tools: options.chunkTools,
      logLabel: options.serviceLabel,
      onDirectSplittingDisabled: summary => {
        l.write('warn', formatDirectSplittingDisabledWarning(options.serviceLabel, summary), { category: 'pipeline', metadata: { chunkPreparation: summary } })
        void queueFallbackStateWrite(session).catch((stateWriteError: unknown) => {
          l.write('debug', `${options.serviceLabel}: deferred OCR PDF fallback state write failed`, {
            category: 'artifact',
            error: stateWriteError,
          })
        })
      },
    })
    session.createChunk = session.adaptiveChunkCreator.createChunk
  }
  return session
}

export const logFallbackProgress = (session: PdfPageFallbackSession, completedPages: number): void => {
  if (completedPages % 25 !== 0 && completedPages !== session.totalPages) return
  l.write('info', `${session.options.serviceLabel}: OCR PDF page fallback completed ${completedPages}/${session.totalPages} pages`, {
    category: 'pipeline',
    metadata: { service: session.options.serviceLabel, completedPages, totalPages: session.totalPages },
  })
}
