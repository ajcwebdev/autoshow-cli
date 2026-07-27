import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  convertDocumentToPdf,
  renderPageToImage,
  splitPdfPages
} from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import type {
  DocumentMetadata,
  FallbackAuditState,
  HostedOcrRun,
  InitialFallbackReason,
  OcrPdfChunkRange,
  PdfChunkPreparationState,
  PdfChunkLocalTools,
  PdfChunkPreparationSummary,
  PdfChunkSplitLogMode,
  PdfChunkSplitResult,
  PdfChunkSplitTool
} from '~/types'
import type { RunHostedOcrPdfChunkFallbackOptions } from '~/types'
import { InternalError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { classifyOcrProviderFailure } from '../ocr-run-state'
import { normalizeOcrPageConcurrency } from './page-concurrency'
import {
  createOcrPdfChunkRenderError,
  DEFAULT_RASTERIZED_PDF_CHUNK_DPI,
  formatPageRangeArg,
  formatRange,
  getOcrPdfChunkRangePageCount,
  hasNonEmptyFile
} from './pdf-chunk-fallback-shared'
import {
  createPdfChunkPreparationState,
  getDisabledSplitTools,
  recordAdaptiveDirectFailure,
  recordAdaptiveDirectSuccess,
  recordSplitAttempts,
  recordToolFallbackSuccess,
  summarizePdfChunkPreparation,
  summarizeSplitFailureMessage
} from './pdf-chunk-preparation-state'
import {
  remapOcrPagesToRange,
  remapOcrProviderUsageToRange,
  stitchHostedOcrChunkRuns
} from './pdf-chunk-page-remap'
import { shouldFallbackToOcrPdfChunks } from './pdf-chunk-fallback-classifier'
import {
  formatDirectSplittingDisabledWarning,
  hasObservedChunkPreparation,
  isProviderWideNonRetryableOcrFailure,
  readFallbackChunkPreparation,
  setFallbackPageAudit,
  summarizeFallbackFailure
} from './pdf-chunk-fallback-audit'
import {
  buildMalformedFallbackPageRun,
  cleanupFallbackPageInputs,
  readCachedFallbackPage,
  resolveFallbackChunkPath,
  resolveInitialFallbackReason,
  validateSinglePageFallbackRun,
  writeCachedFallbackPage,
  writeFallbackPageText,
  writeFallbackPartialText,
  writeFallbackState,
  writeInvalidFallbackPageResponse
} from './pdf-chunk-fallback-state'

export {
  createOcrPdfChunkRenderError,
  HOSTED_OCR_PDF_PAGE_FALLBACK_MODE,
  HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD
} from './pdf-chunk-fallback-shared'
export { shouldFallbackToOcrPdfChunks } from './pdf-chunk-fallback-classifier'
export { stitchHostedOcrChunkRuns } from './pdf-chunk-page-remap'
export { readFallbackAuditRollup } from './pdf-chunk-fallback-audit'

const defaultPdfChunkLocalTools: PdfChunkLocalTools = {
  splitPdfPages,
  renderPageToImage,
  convertDocumentToPdf
}

const createRasterizedSinglePagePdfChunk = async (options: {
  inputPath: string
  outputPath: string
  range: OcrPdfChunkRange
  password?: string | undefined
  dpi?: number | undefined
  tools: PdfChunkLocalTools
}): Promise<void> => {
  if (options.range.startPage !== options.range.endPage) {
    throw createOcrPdfChunkRenderError(options.range, {
      exitCode: 1,
      stderr: 'Rasterized PDF fallback only supports single-page chunks.',
      stdout: '',
      command: `mutool draw (${formatRange(options.range)})`
    })
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-pdf-raster-'))
  const imagePath = join(tempDir, `page-${String(options.range.startPage).padStart(6, '0')}.png`)
  const dpi = Math.max(1, Math.floor(options.dpi ?? DEFAULT_RASTERIZED_PDF_CHUNK_DPI))

  try {
    await rm(options.outputPath, { force: true }).catch(() => {})

    const renderResult = await options.tools.renderPageToImage(
      options.inputPath,
      options.range.startPage,
      dpi,
      imagePath,
      options.password
    )
    if (renderResult.exitCode !== 0 || !await hasNonEmptyFile(imagePath)) {
      throw createOcrPdfChunkRenderError(options.range, {
        exitCode: renderResult.exitCode,
        stderr: renderResult.stderr,
        stdout: renderResult.stdout,
        command: `mutool draw (${formatRange(options.range)})`
      })
    }

    const convertResult = await options.tools.convertDocumentToPdf(imagePath, options.outputPath)
    if (await hasNonEmptyFile(options.outputPath)) {
      if (convertResult.exitCode !== 0) {
        l.warn(
          `mutool convert exited ${convertResult.exitCode} while rasterizing ${formatRange(options.range)} but produced output; using partial result`
        )
      }
      return
    }

    throw createOcrPdfChunkRenderError(options.range, {
      exitCode: convertResult.exitCode,
      stderr: convertResult.stderr,
      stdout: convertResult.stdout,
      command: `mutool convert rasterized page (${formatRange(options.range)})`
    })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

const tryCreateDirectPdfChunk = async (options: {
  inputPath: string
  outputPath: string
  range: OcrPdfChunkRange
  password?: string | undefined
  tools: PdfChunkLocalTools
  splitLogMode?: PdfChunkSplitLogMode | undefined
  logLabel?: string | undefined
  disabledTools?: PdfChunkSplitTool[] | undefined
}): Promise<{ created: boolean, result: PdfChunkSplitResult }> => {
  const splitOptions = options.splitLogMode !== undefined || options.logLabel !== undefined || (options.disabledTools?.length ?? 0) > 0
    ? {
        ...(options.splitLogMode !== undefined ? { logMode: options.splitLogMode } : {}),
        ...(options.logLabel !== undefined ? { logLabel: options.logLabel } : {}),
        ...((options.disabledTools?.length ?? 0) > 0 ? { disabledTools: options.disabledTools } : {})
      }
    : undefined
  const result = await options.tools.splitPdfPages(
    options.inputPath,
    options.outputPath,
    formatPageRangeArg(options.range),
    options.password,
    splitOptions
  )

  if ((result.exitCode === 0 || (result.exitCode === 3 && result.tool === 'qpdf')) && await hasNonEmptyFile(options.outputPath)) {
    return { created: true, result }
  }
  if (await hasNonEmptyFile(options.outputPath)) {
    return { created: true, result }
  }

  return { created: false, result }
}

const buildDirectSplitDiagnosticMetadata = (
  range: OcrPdfChunkRange,
  result: PdfChunkSplitResult
): Record<string, unknown> => ({
  range,
  directSplit: {
    tool: result.tool,
    exitCode: result.exitCode,
    attempts: result.attempts ?? [{ tool: result.tool, exitCode: result.exitCode }],
    message: summarizeSplitFailureMessage(result)
  }
})

const writeDirectSplitFallbackLog = (
  logMode: PdfChunkSplitLogMode,
  range: OcrPdfChunkRange,
  result: PdfChunkSplitResult,
  logLabel?: string | undefined
): void => {
  if (logMode === 'silent') {
    return
  }

  const baseMessage = `PDF chunk extraction failed for ${formatRange(range)}; rasterizing page to PDF`
  const message = logLabel ? `${logLabel}: ${baseMessage}` : baseMessage
  if (logMode === 'debug') {
    l.write('debug', message, { metadata: buildDirectSplitDiagnosticMetadata(range, result) })
    return
  }

  l.write('warn', message, { metadata: buildDirectSplitDiagnosticMetadata(range, result) })
}

const rasterizeAdaptivePdfPageChunk = async (
  state: PdfChunkPreparationState,
  options: {
    inputPath: string
    outputPath: string
    range: OcrPdfChunkRange
    password?: string | undefined
    dpi?: number | undefined
    tools: PdfChunkLocalTools
  }
): Promise<void> => {
  await createRasterizedSinglePagePdfChunk(options)
  state.rasterizedPages += 1
}

const createAdaptivePdfPageChunk = async (
  state: PdfChunkPreparationState,
  options: {
    inputPath: string
    outputPath: string
    range: OcrPdfChunkRange
    password?: string | undefined
    dpi?: number | undefined
    tools: PdfChunkLocalTools
    logLabel?: string | undefined
    onDirectSplittingDisabled?: ((summary: PdfChunkPreparationSummary) => void) | undefined
  }
): Promise<void> => {
  if (state.mode === 'raster-only') {
    await rasterizeAdaptivePdfPageChunk(state, options)
    return
  }

  state.directPageAttempts += 1
  const direct = await tryCreateDirectPdfChunk({
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    range: options.range,
    password: options.password,
    tools: options.tools,
    splitLogMode: 'debug',
    logLabel: options.logLabel,
    disabledTools: getDisabledSplitTools(state)
  })
  recordSplitAttempts(state, direct.result.attempts)

  if (direct.created) {
    recordToolFallbackSuccess(state, options.range, direct.result)
    recordAdaptiveDirectSuccess(state)
    return
  }

  if (options.range.startPage !== options.range.endPage) {
    throw createOcrPdfChunkRenderError(options.range, {
      exitCode: direct.result.exitCode,
      stderr: direct.result.stderr,
      stdout: direct.result.stdout,
      command: `${direct.result.tool} (${formatRange(options.range)})`
    })
  }

  await rasterizeAdaptivePdfPageChunk(state, options)
  writeDirectSplitFallbackLog('debug', options.range, direct.result, options.logLabel)
  recordAdaptiveDirectFailure(state, options.range, direct.result, options.onDirectSplittingDisabled)
}

export const createAdaptiveOcrPdfPageChunkCreator = (options: {
  dpi?: number | undefined
  tools?: PdfChunkLocalTools | undefined
  logLabel?: string | undefined
  onDirectSplittingDisabled?: (summary: PdfChunkPreparationSummary) => void
} = {}): {
  createChunk: (inputPath: string, outputPath: string, range: OcrPdfChunkRange, password?: string | undefined) => Promise<void>
  getSummary: () => PdfChunkPreparationSummary
} => {
  const state = createPdfChunkPreparationState()
  const tools = options.tools ?? defaultPdfChunkLocalTools

  const createChunk = async (
    inputPath: string,
    outputPath: string,
    range: OcrPdfChunkRange,
    password?: string | undefined
  ): Promise<void> => {
    const task = async (): Promise<void> => {
      await createAdaptivePdfPageChunk(state, {
        inputPath,
        outputPath,
        range,
        password,
        dpi: options.dpi,
        tools,
        logLabel: options.logLabel,
        onDirectSplittingDisabled: options.onDirectSplittingDisabled
      })
    }

    if (state.mode === 'adaptive') {
      await state.runExclusiveDirectProbe(task)
      return
    }

    await task()
  }

  return {
    createChunk,
    getSummary: () => summarizePdfChunkPreparation(state) ?? {
      strategy: 'adaptive',
      directPageAttempts: 0,
      directSuccesses: 0,
      directFailures: 0,
      rasterizedPages: 0,
      directSplittingDisabled: false,
      tools: []
    }
  }
}

export const createOcrPdfChunkWithLocalFallback = async (options: {
  inputPath: string
  outputPath: string
  range: OcrPdfChunkRange
  password?: string | undefined
  dpi?: number | undefined
  tools?: PdfChunkLocalTools | undefined
  splitLogMode?: PdfChunkSplitLogMode | undefined
  logLabel?: string | undefined
  directFallbackLogMode?: PdfChunkSplitLogMode | undefined
}): Promise<void> => {
  const tools = options.tools ?? defaultPdfChunkLocalTools
  const direct = await tryCreateDirectPdfChunk({
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    range: options.range,
    password: options.password,
    tools,
    splitLogMode: options.splitLogMode,
    logLabel: options.logLabel
  })

  if (direct.created) {
    return
  }

  if (options.range.startPage === options.range.endPage) {
    writeDirectSplitFallbackLog(
      options.directFallbackLogMode ?? 'warn',
      options.range,
      direct.result,
      options.logLabel
    )
    await createRasterizedSinglePagePdfChunk({
      inputPath: options.inputPath,
      outputPath: options.outputPath,
      range: options.range,
      password: options.password,
      dpi: options.dpi,
      tools
    })
    return
  }

  throw createOcrPdfChunkRenderError(options.range, {
    exitCode: direct.result.exitCode,
    stderr: direct.result.stderr,
    stdout: direct.result.stdout,
    command: `${direct.result.tool} (${formatRange(options.range)})`
  })
}

const defaultCreatePdfChunk = async (
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

const buildChunkMetadata = async (
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

const remapChunkRun = (
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

export const runHostedOcrWithPdfChunkFallback = async (
  options: RunHostedOcrPdfChunkFallbackOptions
): Promise<HostedOcrRun> => {
  const totalPages = Math.max(1, Math.floor(options.totalPages))
  const runPageFallback = async (
    initialFallbackReason: InitialFallbackReason,
    initialFailure?: FallbackAuditState['initialFailure'] | undefined
  ): Promise<HostedOcrRun> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-pdf-pages-'))
    const storedChunkPreparation = options.createChunk === undefined
      ? await readFallbackChunkPreparation(options.fallbackDir)
      : undefined
    const audit: FallbackAuditState = {
      initialFallbackReason,
      ...(initialFailure ? { initialFailure } : {}),
      pageRange: { startPage: 1, endPage: totalPages },
      pages: new Map()
    }
    let stateWrite = Promise.resolve()
    let adaptiveChunkCreator: ReturnType<typeof createAdaptiveOcrPdfPageChunkCreator> | undefined
    const getChunkPreparationSummary = (): PdfChunkPreparationSummary | undefined => {
      const current = adaptiveChunkCreator?.getSummary()
      return hasObservedChunkPreparation(current) ? current : storedChunkPreparation
    }
    const queueFallbackStateWrite = (): Promise<void> => {
      stateWrite = stateWrite.then(async () => {
        await writeFallbackState(options.fallbackDir, options, totalPages, getChunkPreparationSummary(), audit)
      })
      return stateWrite
    }

    adaptiveChunkCreator = options.createChunk === undefined
      ? createAdaptiveOcrPdfPageChunkCreator({
        dpi: options.dpi,
        tools: options.chunkTools,
        logLabel: options.serviceLabel,
        onDirectSplittingDisabled: (summary) => {
          l.write(
            'warn',
            formatDirectSplittingDisabledWarning(options.serviceLabel, summary),
            { metadata: { chunkPreparation: summary } }
          )
          void queueFallbackStateWrite()
        }
      })
      : undefined

    const createChunk = options.createChunk
      ?? adaptiveChunkCreator?.createChunk
      ?? ((inputPath, outputPath, range, password) =>
        defaultCreatePdfChunk(inputPath, outputPath, range, password, options.dpi, options.serviceLabel))

    const logFallbackProgress = (completedPages: number): void => {
      if (completedPages % 25 !== 0 && completedPages !== totalPages) {
        return
      }
      l.write('info', `${options.serviceLabel}: OCR PDF page fallback completed ${completedPages}/${totalPages} pages`)
    }

    await queueFallbackStateWrite()

    const processPage = async (pageNumber: number): Promise<HostedOcrRun> => {
      const cached = await readCachedFallbackPage(options.fallbackDir, pageNumber, totalPages)
      if (cached !== undefined) {
        setFallbackPageAudit(audit, pageNumber, 'cached', {
          chunkPreparation: getChunkPreparationSummary()
        })
        await writeFallbackPageText(options.fallbackDir, pageNumber, cached)
        l.write('debug', `${options.serviceLabel}: OCR fallback page ${pageNumber} already cached`)
        return cached
      }

      const range = { startPage: pageNumber, endPage: pageNumber }
      if (initialFallbackReason === 'fallback-state') {
        setFallbackPageAudit(audit, pageNumber, 'resumed', {
          chunkPreparation: getChunkPreparationSummary()
        })
      }
      const chunkFormat = options.chunkFormat ?? 'pdf'
      const chunkExtension = options.chunkExtension ?? (chunkFormat === 'jpg' ? 'jpg' : chunkFormat)
      const { chunkPath, persistent } = await resolveFallbackChunkPath(
        options.fallbackDir,
        tempDir,
        options.filePath,
        pageNumber,
        chunkExtension
      )
      try {
        l.write('debug', `${options.serviceLabel}: OCR fallback ${formatRange(range)}`)
        if (!await hasNonEmptyFile(chunkPath)) {
          await createChunk(options.filePath, chunkPath, range, options.password)
        }
        const chunkMetadata = await buildChunkMetadata(chunkPath, options.step1Metadata, range, chunkFormat)
        const pageRun = validateSinglePageFallbackRun(
          remapChunkRun(await options.runChunk(chunkPath, chunkMetadata, range), range),
          pageNumber,
          options.serviceLabel
        )
        await writeCachedFallbackPage(options.fallbackDir, pageNumber, totalPages, pageRun)
        setFallbackPageAudit(audit, pageNumber, 'succeeded', {
          chunkPreparation: getChunkPreparationSummary()
        })
        return pageRun
      } catch (error) {
        await writeInvalidFallbackPageResponse(options.fallbackDir, pageNumber, error)
        const malformedPageRun = buildMalformedFallbackPageRun(options, error, range)
        if (malformedPageRun !== undefined) {
          l.warn(`${options.serviceLabel}: OCR fallback page ${pageNumber} returned malformed structured output; treating raw response as page text`)
          await writeCachedFallbackPage(options.fallbackDir, pageNumber, totalPages, malformedPageRun)
          setFallbackPageAudit(audit, pageNumber, 'succeeded', {
            chunkPreparation: getChunkPreparationSummary()
          })
          return malformedPageRun
        }
        setFallbackPageAudit(audit, pageNumber, 'failed', {
          chunkPreparation: getChunkPreparationSummary(),
          failure: summarizeFallbackFailure(error)
        })
        await queueFallbackStateWrite()
        throw error
      } finally {
        if (!persistent) {
          await rm(chunkPath, { force: true }).catch(() => {})
        }
      }
    }

    const runFallbackPageTasks = async (
      pageNumbers: number[],
      onResult: (
        run: HostedOcrRun,
        pageNumber: number,
        index: number,
        results: ReadonlyArray<HostedOcrRun | undefined>
      ) => Promise<void>
    ): Promise<HostedOcrRun[]> => {
      const results: Array<HostedOcrRun | undefined> = new Array(pageNumbers.length)
      const concurrency = normalizeOcrPageConcurrency(options.pageConcurrency)
      let next = 0
      let stopScheduling = false
      let firstError: unknown
      let providerWideBlocker: unknown

      const runWorker = async (): Promise<void> => {
        while (true) {
          if (stopScheduling) {
            return
          }
          const index = next
          next += 1
          if (index >= pageNumbers.length) {
            return
          }
          const pageNumber = pageNumbers[index] as number
          try {
            const result = await processPage(pageNumber)
            results[index] = result
            await onResult(result, pageNumber, index, results)
          } catch (error) {
            firstError = firstError ?? error
            if (isProviderWideNonRetryableOcrFailure(error)) {
              providerWideBlocker = providerWideBlocker ?? error
            }
            stopScheduling = true
            return
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(concurrency, pageNumbers.length) }, async () => {
          await runWorker()
        })
      )

      if (providerWideBlocker !== undefined) {
        const failure = summarizeFallbackFailure(providerWideBlocker)
        for (let index = 0; index < pageNumbers.length; index++) {
          const pageNumber = pageNumbers[index] as number
          if (results[index] !== undefined || audit.pages.has(pageNumber)) {
            continue
          }
          setFallbackPageAudit(audit, pageNumber, 'canceled', {
            chunkPreparation: getChunkPreparationSummary(),
            failure
          })
        }
        await queueFallbackStateWrite()
        await stateWrite
      }

      if (firstError !== undefined) {
        throw firstError
      }

      return results.map((result, index) => {
        if (result === undefined) {
          throw InternalError(`OCR fallback page ${pageNumbers[index]} did not produce a result.`, { stage: 'ocr:pdf-chunk-fallback' })
        }
        return result
      })
    }

    try {
      let partialWrite = Promise.resolve()
      const pageNumbers = Array.from({ length: totalPages }, (_value, index) => index + 1)
      const runs = await runFallbackPageTasks(
        pageNumbers,
        async (_run, _pageNumber, _index, results) => {
          const completedRuns = results.filter((run): run is HostedOcrRun => run !== undefined)
          partialWrite = partialWrite.then(async () => {
            await writeFallbackPartialText(options.fallbackDir, completedRuns)
          })
          await partialWrite
          await queueFallbackStateWrite()
          logFallbackProgress(completedRuns.length)
        }
      )
      await partialWrite
      await writeFallbackPartialText(options.fallbackDir, runs)
      await queueFallbackStateWrite()
      await stateWrite
      const stitched = stitchHostedOcrChunkRuns(runs, totalPages, getChunkPreparationSummary())
      if (options.keepPageInputs !== true) {
        await cleanupFallbackPageInputs(options.fallbackDir, options.serviceLabel)
      }
      return stitched
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

  const initialFallbackReason = await resolveInitialFallbackReason(options, totalPages)
  if (initialFallbackReason !== undefined) {
    if (initialFallbackReason === 'large-pdf') {
      l.write('info', `${options.serviceLabel}: PDF has ${totalPages} pages; using resumable single-page OCR`)
    } else {
      l.write('info', `${options.serviceLabel}: OCR page fallback artifacts found; resuming single-page OCR`)
    }
    return await runPageFallback(initialFallbackReason)
  }

  try {
    return await options.runFull()
  } catch (error) {
    if (!shouldFallbackToOcrPdfChunks(error)) {
      throw error
    }

    const failure = classifyOcrProviderFailure(error)
    const message = failure.message
    l.warn(`${options.serviceLabel}: full-document OCR failed (${message}); retrying PDF one page at a time`)
    return await runPageFallback('full-document-failure', {
      message,
      category: failure.category,
      failureKind: failure.failureKind,
      retryable: failure.retryable,
      ...(failure.blockedReason ? { blockedReason: failure.blockedReason } : {}),
      ...(typeof failure.status === 'number' ? { status: failure.status } : {})
    })
  }
}
